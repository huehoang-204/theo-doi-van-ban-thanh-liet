import "server-only";

import bcrypt from "bcryptjs";

import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { isLocked, nextLockState } from "@/lib/password";

export type LoginFailure = { code: "invalid" } | { code: "locked"; lockedUntil: string };

export type LoginResult =
  { ok: true; user: { id: string; fullName: string } } | ({ ok: false } & LoginFailure);

// Hash giả để so sánh khi tên đăng nhập không tồn tại → thời gian phản hồi như nhau (không lộ tài khoản có tồn tại).
const DUMMY_HASH = "$2b$12$DiyGaP7vVraqY9Bt106.H.x3SwrAUvG3/gCbmGEy7vMjOCYoXc5vG";

export async function verifyLogin(
  username: string,
  password: string,
  ip: string | null,
): Promise<LoginResult> {
  const now = new Date();
  const user = await db.user.findUnique({ where: { username: username.toLowerCase() } });

  if (!user || !user.active) {
    await bcrypt.compare(password, DUMMY_HASH);
    await audit(db, user?.id ?? null, ip, {
      action: "LOGIN_FAILED",
      entity: "User",
      entityId: user?.id,
      after: { username, reason: user ? "inactive" : "unknown_user" },
    });
    return { ok: false, code: "invalid" };
  }

  if (isLocked(user, now)) {
    await audit(db, user.id, ip, {
      action: "LOGIN_FAILED",
      entity: "User",
      entityId: user.id,
      after: { reason: "locked" },
    });
    return { ok: false, code: "locked", lockedUntil: user.lockedUntil!.toISOString() };
  }

  const success = await bcrypt.compare(password, user.passwordHash);
  const lock = nextLockState(user, success, now);

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { ...lock, ...(success ? { lastLoginAt: now } : {}) },
    });
    await audit(tx, user.id, ip, {
      action: success ? "LOGIN" : "LOGIN_FAILED",
      entity: "User",
      entityId: user.id,
      after: success ? undefined : { reason: lock.lockedUntil ? "locked_now" : "wrong_password" },
    });
  });

  if (success) return { ok: true, user: { id: user.id, fullName: user.fullName } };
  if (lock.lockedUntil)
    return { ok: false, code: "locked", lockedUntil: lock.lockedUntil.toISOString() };
  return { ok: false, code: "invalid" };
}
