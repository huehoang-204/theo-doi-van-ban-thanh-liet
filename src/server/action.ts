import "server-only";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { audit, type AuditEntry } from "@/lib/audit";
import { db } from "@/lib/db";
import { can, type Action } from "@/lib/permissions";
import { clientIp, getCurrentUser, type CurrentUser } from "@/server/auth/current-user";
import { type ActionResult, AppError } from "@/server/errors";

z.config(z.locales.vi());

export type ActionContext<I> = {
  user: CurrentUser;
  input: I;
  tx: Prisma.TransactionClient;
  /** Ghi nhật ký — lưu trong cùng transaction với thao tác */
  audit: (entry: AuditEntry) => void;
};

type Permission<I> =
  | Action
  | ((user: CurrentUser, input: I, tx: Prisma.TransactionClient) => boolean | Promise<boolean>);

type WithAuthOptions<S extends z.ZodType> = {
  /** Quyền theo bảng Mục 12; hàm khi cần xét theo đối tượng (đọc DB trong cùng transaction) */
  permission: Permission<z.output<S>>;
  schema: S;
  /** Đường dẫn cần làm mới sau khi ghi */
  revalidate?: string[];
  /** Cho phép tài khoản đang bị bắt đổi mật khẩu (chỉ dùng cho chính thao tác đổi mật khẩu) */
  allowMustChangePassword?: boolean;
};

/** Mã lỗi ngắn để người dùng báo hỗ trợ; chi tiết đầy đủ chỉ ở log server */
function supportCode(): string {
  return `E${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 5)}`.toUpperCase();
}

function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    out[key] ??= issue.message;
  }
  return out;
}

function prismaError(error: Prisma.PrismaClientKnownRequestError): AppError | null {
  if (error.code === "P2002")
    return new AppError(
      "DUPLICATE",
      "Dữ liệu bị trùng với một bản ghi đã có (VD: trùng tên). Vui lòng kiểm tra lại.",
    );
  if (error.code === "P2003")
    return new AppError(
      "IN_USE",
      "Không thể xoá vì dữ liệu này đang được sử dụng ở nơi khác. Hãy chuyển sang trạng thái “Ngừng sử dụng”.",
    );
  if (error.code === "P2025")
    return new AppError(
      "NOT_FOUND",
      "Không tìm thấy dữ liệu — có thể đã bị xoá. Vui lòng tải lại trang.",
    );
  return null;
}

/**
 * Hàm bọc cho MỌI thao tác ghi (Mục 17.6):
 * phiên + quyền → zod.parse → transaction (thao tác + audit) → revalidatePath.
 * Không bao giờ ném lỗi ra client — luôn trả ActionResult với câu tiếng Việt.
 */
export function withAuth<S extends z.ZodType, T>(
  options: WithAuthOptions<S>,
  handler: (ctx: ActionContext<z.output<S>>) => Promise<T>,
): (raw: z.input<S>) => Promise<ActionResult<T>> {
  return async (raw) => {
    try {
      const user = await getCurrentUser();
      if (!user)
        throw new AppError(
          "UNAUTHENTICATED",
          "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
        );
      if (user.mustChangePassword && !options.allowMustChangePassword) {
        throw new AppError("MUST_CHANGE_PASSWORD", "Bạn cần đổi mật khẩu trước khi tiếp tục.");
      }
      if (typeof options.permission === "string" && !can(user, options.permission)) {
        throw new AppError("FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.");
      }

      const parsed = options.schema.safeParse(raw);
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: "VALIDATION",
            message: "Thông tin nhập chưa hợp lệ. Vui lòng kiểm tra các ô được đánh dấu.",
            fieldErrors: zodFieldErrors(parsed.error),
          },
        };
      }
      const input = parsed.data as z.output<S>;
      const ip = clientIp(await headers());

      const data = await db.$transaction(async (tx) => {
        if (
          typeof options.permission === "function" &&
          !(await options.permission(user, input, tx))
        ) {
          throw new AppError("FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.");
        }
        const entries: AuditEntry[] = [];
        const result = await handler({ user, input, tx, audit: (e) => entries.push(e) });
        await audit(tx, user.id, ip, entries);
        return result;
      });

      for (const path of options.revalidate ?? []) revalidatePath(path);
      return { ok: true, data };
    } catch (error) {
      if (error instanceof AppError) return { ok: false, error: error.toJSON() };
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        const mapped = prismaError(error);
        if (mapped) return { ok: false, error: mapped.toJSON() };
      }
      const code = supportCode();
      console.error(`[action] ${code}`, error);
      return {
        ok: false,
        error: {
          code,
          message: `Hệ thống gặp sự cố khi lưu dữ liệu. Vui lòng thử lại; nếu vẫn lỗi, báo quản trị viên mã lỗi ${code}.`,
        },
      };
    }
  };
}
