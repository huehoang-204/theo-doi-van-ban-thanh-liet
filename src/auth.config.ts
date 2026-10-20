// Cấu hình Auth.js dùng chung — KHÔNG import Prisma/bcrypt ở đây vì proxy cũng dùng file này.
import type { NextAuthConfig } from "next-auth";

/** Phiên hết hạn sau 8 giờ không hoạt động (Mục 13.2) */
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

/** Đường dẫn không cần đăng nhập */
const PUBLIC_PATHS = ["/dang-nhap"];

export const authConfig = {
  pages: { signIn: "/dang-nhap" },
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE_SECONDS,
    // Gia hạn cookie phiên mỗi khi có hoạt động sau 5 phút → "8 giờ không hoạt động"
    updateAge: 5 * 60,
  },
  // Production chạy HTTPS → cookie secure; dev trong LAN chạy http (COOKIE_SECURE=false).
  useSecureCookies: process.env.COOKIE_SECURE === "true",
  trustHost: true,
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true;
      return !!auth?.user;
    },
    jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      return token;
    },
    session({ session, token }) {
      if (typeof token.uid === "string") session.user.id = token.uid;
      return session;
    },
  },
} satisfies NextAuthConfig;
