import { IMPORT_SPECS, isImportKind } from "@/lib/excel/import-specs";
import { apiUser } from "@/server/auth/api";
import { IMPORT_PERMISSIONS } from "@/server/excel/import-permissions";
import { buildImportTemplate, xlsxResponse } from "@/server/excel/workbook";

// GET /api/import/{kind}/mau — file mẫu nhập liệu
export async function GET(_request: Request, { params }: RouteContext<"/api/import/[kind]/mau">) {
  const { kind } = await params;
  if (!isImportKind(kind))
    return Response.json({ message: "Không có mẫu nhập này." }, { status: 404 });
  const user = await apiUser(IMPORT_PERMISSIONS[kind]);
  if (user instanceof Response) return user;
  const spec = IMPORT_SPECS[kind];
  return xlsxResponse(await buildImportTemplate(spec), `Mau-nhap_${spec.title}.xlsx`);
}
