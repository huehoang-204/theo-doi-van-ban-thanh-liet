import { describe, expect, it } from "vitest";

import {
  generateTemporaryPassword,
  isLocked,
  nextLockState,
  passwordSchema,
  type LockState,
} from "@/lib/password";

describe("chính sách mật khẩu", () => {
  it("chấp nhận ≥ 8 ký tự có chữ và số (kể cả chữ có dấu)", () => {
    expect(passwordSchema.safeParse("ThanhLiet@2026").success).toBe(true);
    expect(passwordSchema.safeParse("mậtkhẩu1").success).toBe(true);
  });

  it("từ chối mật khẩu ngắn, thiếu chữ hoặc thiếu số — kèm câu báo lỗi tiếng Việt", () => {
    const short = passwordSchema.safeParse("ab12");
    expect(short.success).toBe(false);
    expect(short.error?.issues[0]?.message).toBe("Mật khẩu phải có ít nhất 8 ký tự.");
    expect(passwordSchema.safeParse("12345678").error?.issues[0]?.message).toBe(
      "Mật khẩu phải có ít nhất một chữ cái.",
    );
    expect(passwordSchema.safeParse("abcdefgh").error?.issues[0]?.message).toBe(
      "Mật khẩu phải có ít nhất một chữ số.",
    );
  });

  it("mật khẩu tạm luôn đạt chính sách", () => {
    for (let i = 0; i < 50; i++) {
      expect(passwordSchema.safeParse(generateTemporaryPassword()).success).toBe(true);
    }
  });
});

describe("khoá tài khoản sau 5 lần sai", () => {
  const now = new Date("2026-10-20T02:00:00Z");
  const fresh: LockState = { failedLoginCount: 0, lockedUntil: null };

  it("4 lần sai chưa khoá, lần thứ 5 khoá 15 phút", () => {
    let state = fresh;
    for (let i = 1; i <= 4; i++) {
      state = nextLockState(state, false, now);
      expect(state).toEqual({ failedLoginCount: i, lockedUntil: null });
      expect(isLocked(state, now)).toBe(false);
    }
    state = nextLockState(state, false, now);
    expect(state.lockedUntil?.toISOString()).toBe("2026-10-20T02:15:00.000Z");
    expect(isLocked(state, now)).toBe(true);
    expect(isLocked(state, new Date("2026-10-20T02:14:59Z"))).toBe(true);
    expect(isLocked(state, new Date("2026-10-20T02:15:00Z"))).toBe(false);
  });

  it("đăng nhập đúng xoá bộ đếm", () => {
    expect(nextLockState({ failedLoginCount: 3, lockedUntil: null }, true, now)).toEqual(fresh);
  });
});
