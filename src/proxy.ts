// Proxy (Next 16, trước đây là middleware): chuyển người chưa đăng nhập về /dang-nhap và
// gia hạn cookie phiên khi có hoạt động. Chỉ là lớp chặn sớm — mọi trang/route vẫn tự kiểm tra quyền.
import NextAuth from "next-auth";
import type { NextFetchEvent, NextRequest } from "next/server";

import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);
const authProxy = auth as unknown as (
  request: NextRequest,
  event: NextFetchEvent,
) => Promise<Response | undefined>;

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  return authProxy(request, event);
}

export const config = {
  // Bỏ qua API (tự kiểm tra phiên, tránh proxy đệm body tệp tải lên), tài nguyên tĩnh, ảnh, favicon.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|woff2?)$).*)",
  ],
};
