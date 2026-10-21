import { apiUser } from "@/server/auth/api";
import { getDashboard } from "@/server/dashboard/data";

// GET /api/dashboard?schoolYear=2026-2027 — toàn bộ số liệu Bảng điều hành trong 1 lần gọi (Mục 11, 7.3)
export async function GET(request: Request) {
  const user = await apiUser("dashboard.viewReduced");
  if (user instanceof Response) return user;
  const schoolYear = new URL(request.url).searchParams.get("schoolYear");
  return Response.json(await getDashboard(user, schoolYear), {
    headers: { "Cache-Control": "no-store" },
  });
}
