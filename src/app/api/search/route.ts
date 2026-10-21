import { apiUser } from "@/server/auth/api";
import { globalSearch } from "@/server/search/global";

// GET /api/search?q= — tìm kiếm toàn cục (Ctrl+K), không dấu, theo phạm vi xem của người dùng
export async function GET(request: Request) {
  const user = await apiUser("search.global");
  if (user instanceof Response) return user;
  const q = new URL(request.url).searchParams.get("q") ?? "";
  return Response.json(await globalSearch(user, q), { headers: { "Cache-Control": "no-store" } });
}
