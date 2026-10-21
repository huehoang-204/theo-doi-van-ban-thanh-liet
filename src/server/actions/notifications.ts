"use server";

import { z } from "zod";

import { withAuth } from "@/server/action";

// Đánh dấu đã đọc — chỉ thông báo của chính mình; không ghi nhật ký (không phải thay đổi dữ liệu nghiệp vụ)

export const markNotificationRead = withAuth(
  { permission: "notification.view", schema: z.object({ id: z.string().min(1) }) },
  async ({ tx, input, user }) => {
    const r = await tx.notification.updateMany({
      where: { id: input.id, userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: r.count };
  },
);

export const markAllNotificationsRead = withAuth(
  { permission: "notification.view", schema: z.object({}), revalidate: ["/thong-bao"] },
  async ({ tx, user }) => {
    const r = await tx.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: r.count };
  },
);
