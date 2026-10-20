import { revalidatePath } from "next/cache";

import { IMPORT_SPECS, isImportKind } from "@/lib/excel/import-specs";
import { formatImportError, parseSheet, type ImportRowError } from "@/lib/excel/parse";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { apiUser } from "@/server/auth/api";
import { clientIp } from "@/server/auth/current-user";
import { IMPORTERS } from "@/server/excel/importers";
import { IMPORT_PERMISSIONS } from "@/server/excel/import-permissions";
import { readFirstSheet } from "@/server/excel/workbook";

const MAX_BYTES = 5 * 1024 * 1024;
const PAGE_OF: Record<string, string> = {
  schools: "/dia-ban/truong-hoc",
  residentials: "/dia-ban/to-dan-pho",
  "party-orgs": "/dia-ban/to-chuc-dang",
};

/** Lỗi nghiệp vụ trong transaction → huỷ toàn bộ lần nhập */
class ImportRejected extends Error {
  constructor(readonly errors: ImportRowError[]) {
    super("import rejected");
  }
}

function failure(errors: string[], status = 422) {
  return Response.json({ ok: false, errors }, { status });
}

// POST /api/import/{schools|residentials|party-orgs} — multipart, trường "file" (.xlsx)
export async function POST(request: Request, { params }: RouteContext<"/api/import/[kind]">) {
  const { kind } = await params;
  if (!isImportKind(kind))
    return Response.json({ message: "Không có loại nhập này." }, { status: 404 });
  const user = await apiUser(IMPORT_PERMISSIONS[kind]);
  if (user instanceof Response) return user;

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0)
    return failure(["Vui lòng chọn tệp Excel (.xlsx) để nhập."], 400);
  if (file.size > MAX_BYTES) return failure(["Tệp quá lớn (tối đa 5 MB)."], 400);

  const buffer = await file.arrayBuffer();
  // .xlsx là tệp ZIP — kiểm tra chữ ký "PK" thay vì tin phần mở rộng
  const head = new Uint8Array(buffer.slice(0, 2));
  if (head[0] !== 0x50 || head[1] !== 0x4b) {
    return failure(
      [
        "Tệp không phải định dạng Excel .xlsx. Nếu là .xls, hãy mở bằng Excel và lưu lại dạng .xlsx.",
      ],
      400,
    );
  }

  let sheet;
  try {
    sheet = await readFirstSheet(buffer);
  } catch {
    return failure(["Không đọc được tệp Excel — tệp có thể bị hỏng hoặc có mật khẩu."], 400);
  }

  const spec = IMPORT_SPECS[kind];
  const parsed = parseSheet(spec, sheet);
  if (parsed.errors.length > 0) return failure(parsed.errors.map(formatImportError));

  try {
    const summary = await db.$transaction(
      async (tx) => {
        const errors: ImportRowError[] = [];
        const result = await IMPORTERS[kind]({ tx, userId: user.id, errors }, parsed.rows);
        if (errors.length > 0) throw new ImportRejected(errors);
        await audit(tx, user.id, clientIp(request.headers), {
          action: "IMPORT",
          entity: kind,
          after: { fileName: file.name, rows: parsed.rows.length, ...result },
        });
        return result;
      },
      { timeout: 60_000 },
    );
    revalidatePath(PAGE_OF[kind]!);
    revalidatePath("/");
    return Response.json({ ok: true, total: parsed.rows.length, ...summary });
  } catch (error) {
    if (error instanceof ImportRejected) {
      return failure(error.errors.sort((a, b) => a.row - b.row).map(formatImportError));
    }
    const code = `E${Date.now().toString(36).slice(-6).toUpperCase()}`;
    console.error(`[import] ${code}`, error);
    return failure(
      [`Hệ thống gặp sự cố khi lưu dữ liệu. Không có dòng nào được nhập. Mã lỗi ${code}.`],
      500,
    );
  }
}
