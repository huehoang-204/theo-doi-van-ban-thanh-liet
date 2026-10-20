import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { can, type Action, type AuthUser } from "@/lib/permissions";

export type CurrentUser = AuthUser & {
  username: string;
  fullName: string;
  position: string | null;
  departmentName: string | null;
  mustChangePassword: boolean;
  fontScale: number;
};

/**
 * Người dùng hiện tại, đọc lại từ CSDL mỗi request (cache trong 1 request) —
 * khoá/đổi vai trò tài khoản có hiệu lực ngay, không chờ hết hạn JWT.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      fullName: true,
      position: true,
      roles: true,
      departmentId: true,
      department: { select: { name: true } },
      active: true,
      mustChangePassword: true,
      fontScale: true,
    },
  });
  if (!user || !user.active) return null;
  const { department, active: _active, ...rest } = user;
  return { ...rest, departmentName: department?.name ?? null };
});

/** Bắt buộc đăng nhập; tài khoản phải đổi mật khẩu thì chuyển sang trang đổi mật khẩu */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/dang-nhap");
  if (user.mustChangePassword) redirect("/doi-mat-khau");
  return user;
}

/** Bắt buộc có quyền; không có → trang "Không có quyền truy cập" */
export async function requirePermission(action: Action): Promise<CurrentUser> {
  const user = await requireUser();
  if (!can(user, action)) redirect("/khong-co-quyen");
  return user;
}

export function clientIp(headers: Headers): string | null {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? headers.get("x-real-ip");
}
