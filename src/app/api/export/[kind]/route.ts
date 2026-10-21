import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { apiUser } from "@/server/auth/api";
import { clientIp } from "@/server/auth/current-user";
import { EXPORTS, exportFileStamp } from "@/server/excel/exports";
import { xlsxResponse } from "@/server/excel/workbook";

// GET /api/export/{audit-log|schools|residentials|party-orgs|users|departments|document-types|fields|issuing-agencies|old-areas}
export async function GET(request: Request, { params }: RouteContext<"/api/export/[kind]">) {
  const { kind } = await params;
  const def = EXPORTS[kind];
  if (!def) return Response.json({ message: "Không có bảng dữ liệu này." }, { status: 404 });

  const user = await apiUser(def.permission);
  if (user instanceof Response) return user;

  const search = new URL(request.url).searchParams;
  const [buffer, name] = await Promise.all([def.build(search, user), def.fileName(search)]);
  await audit(db, user.id, clientIp(request.headers), {
    action: "EXPORT",
    entity: kind,
    after: Object.fromEntries(search),
  });
  return xlsxResponse(buffer, name.replace(/\.xlsx$/, `_${exportFileStamp()}.xlsx`));
}
