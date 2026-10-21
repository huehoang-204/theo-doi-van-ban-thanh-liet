import { listNotifications } from "@/server/notifications";
import { apiUser } from "@/server/auth/api";

/** Chuông thông báo: số chưa đọc + các thông báo mới nhất (`?soLuong=10&chuaDoc=1`) */
export async function GET(request: Request) {
  const user = await apiUser("notification.view");
  if (user instanceof Response) return user;
  const params = new URL(request.url).searchParams;
  const data = await listNotifications(user.id, {
    limit: Number(params.get("soLuong")) || 10,
    unreadOnly: params.get("chuaDoc") === "1",
  });
  return Response.json(data, { headers: { "Cache-Control": "no-store" } });
}
