import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

import { authConfig } from "@/auth.config";
import { verifyLogin, type LoginFailure } from "@/server/auth/login";

/** Lỗi đăng nhập mang mã ngắn (không lộ chi tiết) — form đăng nhập đổi mã sang câu tiếng Việt */
export class LoginError extends CredentialsSignin {
  constructor(public readonly reason: LoginFailure) {
    super();
    this.code = reason.code;
  }
}

const credentialsSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(128),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { username: {}, password: {} },
      async authorize(raw, request) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) throw new LoginError({ code: "invalid" });
        const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
        const result = await verifyLogin(parsed.data.username, parsed.data.password, ip);
        if (!result.ok) throw new LoginError(result);
        return { id: result.user.id, name: result.user.fullName };
      },
    }),
  ],
});
