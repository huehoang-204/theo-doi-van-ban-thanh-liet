import "server-only";

import type { Prisma } from "@/generated/prisma/client";

export type NotificationKind =
  | "TASK_ASSIGNED"
  | "TASK_SUBMITTED"
  | "TASK_APPROVED"
  | "TASK_RETURNED"
  | "TASK_CANCELLED"
  | "EXTENSION_REQUEST"
  | "EXTENSION_DECIDED"
  | "REPORT_REQUIRED"
  | "REPORT_SUBMITTED";

/** Ghi thông báo trong ứng dụng (Mục 5.4) — chuông hiển thị ở Giai đoạn 5 */
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
