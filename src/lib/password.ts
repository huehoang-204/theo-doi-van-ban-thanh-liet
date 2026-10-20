// Chính sách mật khẩu & khoá tài khoản (Mục 13.2). Hàm thuần — dùng chung client/server.
import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 8;
export const BCRYPT_COST = 12;
export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;

/** Tối thiểu 8 ký tự, có cả chữ và số */
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Mật khẩu phải có ít nhất ${PASSWORD_MIN_LENGTH} ký tự.`)
  .max(128, "Mật khẩu quá dài (tối đa 128 ký tự).")
  .refine((v) => /\p{L}/u.test(v), "Mật khẩu phải có ít nhất một chữ cái.")
  .refine((v) => /\d/.test(v), "Mật khẩu phải có ít nhất một chữ số.");

export type LockState = { failedLoginCount: number; lockedUntil: Date | null };

export function isLocked(state: LockState, now: Date): boolean {
  return state.lockedUntil !== null && state.lockedUntil.getTime() > now.getTime();
}

/**
 * Trạng thái mới sau một lần đăng nhập (chỉ gọi khi tài khoản KHÔNG đang bị khoá).
 *  - Đúng mật khẩu → xoá bộ đếm.
 *  - Sai lần thứ 5 → khoá 15 phút, đếm lại từ 0 sau khi hết khoá.
 */
export function nextLockState(state: LockState, success: boolean, now: Date): LockState {
  if (success) return { failedLoginCount: 0, lockedUntil: null };
  const failed = state.failedLoginCount + 1;
  if (failed >= MAX_FAILED_LOGINS) {
    return { failedLoginCount: 0, lockedUntil: new Date(now.getTime() + LOCK_MINUTES * 60_000) };
  }
  return { failedLoginCount: failed, lockedUntil: null };
}

/** Mật khẩu tạm khi quản trị đặt lại: dễ đọc (bỏ ký tự dễ nhầm), đủ chữ + số */
export function generateTemporaryPassword(random: () => number = Math.random): string {
  const letters = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const pick = (set: string) => set[Math.floor(random() * set.length)] ?? set[0];
  const chars = [
    ...Array.from({ length: 6 }, () => pick(letters)),
    ...Array.from({ length: 4 }, () => pick(digits)),
  ];
  return chars.join("");
}
