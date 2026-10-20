"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import { BCRYPT_COST, generateTemporaryPassword } from "@/lib/password";
import { createUserSchema, updateUserSchema } from "@/lib/schemas/user";
import { withAuth } from "@/server/action";
import { AppError } from "@/server/errors";

const PATHS = ["/quan-tri/nguoi-dung"];
const idSchema = z.object({ id: z.string().min(1) });

const SAFE_SELECT = {
  id: true,
  username: true,
  fullName: true,
  position: true,
  phone: true,
  email: true,
  departmentId: true,
  roles: true,
  active: true,
} satisfies Prisma.UserSelect;

/** Luôn còn ít nhất một quản trị viên đang hoạt động */
async function assertAdminRemains(tx: Prisma.TransactionClient, excludingId: string) {
  const others = await tx.user.count({
    where: { active: true, roles: { has: "ADMIN" }, NOT: { id: excludingId } },
  });
  if (others === 0) {
    throw new AppError("LAST_ADMIN", "Hệ thống phải còn ít nhất một quản trị viên đang hoạt động.");
  }
}

export const createUser = withAuth(
  { permission: "user.manage", schema: createUserSchema, revalidate: PATHS },
  async ({ tx, input: { password, ...data }, audit }) => {
    const created = await tx.user.create({
      data: {
        ...data,
        passwordHash: await bcrypt.hash(password, BCRYPT_COST),
        mustChangePassword: true,
      },
      select: SAFE_SELECT,
    });
    audit({ action: "CREATE", entity: "User", entityId: created.id, after: created });
    return created.id;
  },
);

export const updateUser = withAuth(
  { permission: "user.manage", schema: updateUserSchema, revalidate: PATHS },
  async ({ tx, user, input: { id, ...data }, audit }) => {
    const before = await tx.user.findUniqueOrThrow({ where: { id }, select: SAFE_SELECT });
    const losesAdmin =
      before.roles.includes("ADMIN") &&
      before.active &&
      (!data.roles.includes("ADMIN") || !data.active);
    if (losesAdmin) {
      if (id === user.id) {
        throw new AppError(
          "SELF_LOCKOUT",
          "Bạn không thể tự bỏ quyền quản trị hoặc tự ngừng tài khoản của mình.",
        );
      }
      await assertAdminRemains(tx, id);
    }
    const after = await tx.user.update({ where: { id }, data, select: SAFE_SELECT });
    audit({ action: "UPDATE", entity: "User", entityId: id, before, after });
    return id;
  },
);

/** Đặt lại mật khẩu: sinh mật khẩu tạm (hiện 1 lần cho quản trị), bắt đổi khi đăng nhập, mở khoá */
export const resetUserPassword = withAuth(
  { permission: "user.manage", schema: idSchema, revalidate: PATHS },
  async ({ tx, input: { id }, audit }) => {
    const temporaryPassword = generateTemporaryPassword();
    await tx.user.update({
      where: { id },
      data: {
        passwordHash: await bcrypt.hash(temporaryPassword, BCRYPT_COST),
        mustChangePassword: true,
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });
    audit({ action: "RESET_PASSWORD", entity: "User", entityId: id });
    return { temporaryPassword };
  },
);

export const unlockUser = withAuth(
  { permission: "user.manage", schema: idSchema, revalidate: PATHS },
  async ({ tx, input: { id }, audit }) => {
    await tx.user.update({ where: { id }, data: { failedLoginCount: 0, lockedUntil: null } });
    audit({ action: "UNLOCK", entity: "User", entityId: id });
    return id;
  },
);
