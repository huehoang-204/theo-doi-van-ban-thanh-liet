import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export type NotificationKind =
  | "TASK_ASSIGNED"
  | "TASK_SUBMITTED"
  | "TASK_APPROVED"
  | "TASK_RETURNED"
  | "TASK_CANCELLED"
  | "EXTENSION_REQUEST"
  | "EXTENSION_DECIDED"
  | "REPORT_REQUIRED"
  | "REPORT_SUBMITTED"
  | "NEW_DOCUMENT"
  | "DOCUMENT_PUBLISHED"
  | "DOCUMENT_COMMENT"
  // Do job 06:30 sinh (src/server/jobs/daily.ts)
  | "DUE_SOON"
  | "OVERDUE";

/** Ghi thông báo trong ứng dụng (Mục 5.4) — hiện ở chuông trên header */
export async function notify(
  tx: Prisma.TransactionClient,
  userIds: Iterable<string | null | undefined>,
  data: { kind: NotificationKind; title: string; link: string },
  exceptUserId?: string,
): Promise<void> {
  const ids = [...new Set([...userIds].filter((u): u is string => !!u && u !== exceptUserId))];
  if (ids.length === 0) return;
  await tx.notification.createMany({ data: ids.map((userId) => ({ userId, ...data })) });
}

/** Người nhận theo đơn vị: mọi tài khoản đang hoạt động của đơn vị */
export async function usersOfDepartments(
  tx: Prisma.TransactionClient,
  departmentIds: Iterable<string | null | undefined>,
) {
  const ids = [...new Set([...departmentIds].filter((d): d is string => !!d))];
  if (ids.length === 0) return [];
  const users = await tx.user.findMany({
    where: { departmentId: { in: ids }, active: true },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

// ---------------------------------------------------------------- Đọc (chuông, trang Thông báo)

export type NotificationDTO = {
  id: string;
  kind: string;
  title: string;
  link: string;
  createdAt: string;
  readAt: string | null;
};

const toDTO = (n: {
  id: string;
  kind: string;
  title: string;
  link: string;
  createdAt: Date;
  readAt: Date | null;
}): NotificationDTO => ({
  id: n.id,
  kind: n.kind,
  title: n.title,
  link: n.link,
  createdAt: n.createdAt.toISOString(),
  readAt: n.readAt?.toISOString() ?? null,
});

export async function listNotifications(
  userId: string,
  options: { limit?: number; unreadOnly?: boolean; page?: number } = {},
): Promise<{ items: NotificationDTO[]; unread: number; total: number }> {
  const limit = Math.min(Math.max(options.limit ?? 10, 1), 100);
  const where = { userId, ...(options.unreadOnly ? { readAt: null } : {}) };
  const [rows, unread, total] = await Promise.all([
    db.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: ((options.page ?? 1) - 1) * limit,
    }),
    db.notification.count({ where: { userId, readAt: null } }),
    db.notification.count({ where }),
  ]);
  return { items: rows.map(toDTO), unread, total };
}
