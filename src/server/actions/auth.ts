"use server";

import bcrypt from "bcryptjs";
import { AuthError, CredentialsSignin } from "next-auth";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { signIn, signOut } from "@/auth";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { FONT_SCALE_COOKIE, FONT_SCALES, parseFontScale } from "@/lib/font-scale";
import { formatDateTime } from "@/lib/format";
import { BCRYPT_COST } from "@/lib/password";
import { homePathFor } from "@/lib/permissions";
import { changePasswordSchema } from "@/lib/schemas/auth";
import { withAuth } from "@/server/action";
import { clientIp, getCurrentUser } from "@/server/auth/current-user";
import { AppError } from "@/server/errors";

export type LoginState = { error?: string; username?: string };

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Đường dẫn quay lại sau đăng nhập. Auth.js gửi URL tuyệt đối (http://host/duong-dan) → chỉ lấy
 * pathname + query, bỏ hẳn origin, nên không thể bị lợi dụng chuyển hướng ra trang ngoài.
 */
function safeCallback(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || value === "") return null;
  let path: string;
  try {
    const url = new URL(value, "http://noi-bo.invalid");
    path = `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  if (
    path === "/" ||
    path.startsWith("/dang-nhap") ||
    path.startsWith("/api") ||
    path.startsWith("/doi-mat-khau")
  )
    return null;
  return path;
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!username || !password) {
    return { username, error: "Vui lòng nhập tên đăng nhập và mật khẩu." };
  }

  try {
    await signIn("credentials", { username, password, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) {
      const code = error instanceof CredentialsSignin ? error.code : "invalid";
      if (code === "locked") {
        const user = await db.user.findUnique({
          where: { username },
          select: { lockedUntil: true },
        });
        const until = user?.lockedUntil ? formatDateTime(user.lockedUntil).slice(-5) : "";
        return {
          username,
          error: `Tài khoản tạm khoá do nhập sai mật khẩu 5 lần. Vui lòng thử lại sau ${until}.`,
        };
      }
      return { username, error: "Tên đăng nhập hoặc mật khẩu không đúng." };
    }
    throw error;
  }

  const user = await db.user.findUniqueOrThrow({
    where: { username },
    select: {
      id: true,
      roles: true,
      departmentId: true,
      fontScale: true,
      mustChangePassword: true,
    },
  });
  // Cỡ chữ đã lưu theo người dùng → áp dụng ngay trên thiết bị này
  (await cookies()).set(FONT_SCALE_COOKIE, String(parseFontScale(user.fontScale)), {
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
    sameSite: "lax",
  });

  if (user.mustChangePassword) redirect("/doi-mat-khau");
  redirect((safeCallback(formData.get("callbackUrl")) ?? homePathFor(user)) as never);
}

export async function logoutAction(): Promise<void> {
  const user = await getCurrentUser();
  if (user) {
    await audit(db, user.id, clientIp(await headers()), {
      action: "LOGOUT",
      entity: "User",
      entityId: user.id,
    });
  }
  await signOut({ redirectTo: "/dang-nhap" });
}

export const changePassword = withAuth(
  { permission: () => true, schema: changePasswordSchema, allowMustChangePassword: true },
  async ({ user, input, tx, audit }) => {
    const current = await tx.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { passwordHash: true },
    });
    if (!(await bcrypt.compare(input.currentPassword, current.passwordHash))) {
      throw new AppError("WRONG_PASSWORD", "Mật khẩu hiện tại không đúng.", {
        currentPassword: "Mật khẩu hiện tại không đúng.",
      });
    }
    await tx.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(input.newPassword, BCRYPT_COST),
        mustChangePassword: false,
      },
    });
    audit({ action: "CHANGE_PASSWORD", entity: "User", entityId: user.id });
    return { home: homePathFor(user) };
  },
);

/** Lưu cỡ chữ A−/A+ theo người dùng (không ghi nhật ký — chỉ là tuỳ chọn hiển thị) */
export const saveFontScale = withAuth(
  {
    permission: () => true,
    schema: z.number().refine((v) => (FONT_SCALES as readonly number[]).includes(v)),
    allowMustChangePassword: true,
  },
  async ({ user, input, tx }) => {
    await tx.user.update({ where: { id: user.id }, data: { fontScale: input } });
    return null;
  },
);
