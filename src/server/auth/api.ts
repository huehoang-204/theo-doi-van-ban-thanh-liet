import "server-only";

import { can, type Action } from "@/lib/permissions";
import { getCurrentUser, type CurrentUser } from "@/server/auth/current-user";

/** Kiểm tra phiên + quyền cho Route Handler; trả Response lỗi (JSON tiếng Việt) nếu không đạt */
export async function apiUser(action: Action): Promise<CurrentUser | Response> {
  const user = await getCurrentUser();
  if (!user)
    return Response.json(
      { message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." },
      { status: 401 },
    );
  if (user.mustChangePassword)
    return Response.json({ message: "Bạn cần đổi mật khẩu trước khi tiếp tục." }, { status: 403 });
  if (!can(user, action))
    return Response.json(
      { message: "Bạn không có quyền thực hiện thao tác này." },
      { status: 403 },
    );
  return user;
}
