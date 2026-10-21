// Job đêm (00:15 giờ VN): tính lại tiến độ cộng dồn + chấm đỏ toàn bộ cây (việc chuyển "quá hạn" khi sang ngày),
// dọn Thùng rác quá 30 ngày, xoá thông báo đã đọc quá 90 ngày.
import type { PrismaClient } from "@/generated/prisma/client";
import { vnDateKey } from "@/lib/format";
import { recomputeAllTrees } from "@/server/documents/progress";
import { purgeExpiredTrash, type PurgeResult } from "@/server/jobs/trash";

export const NOTIFICATION_KEEP_DAYS = 90;

export type NightlyJobResult = {
  nodesUpdated: number;
  trash: PurgeResult;
  notificationsRemoved: number;
};

export async function runNightlyJob(db: PrismaClient, now = new Date()): Promise<NightlyJobResult> {
  const nodesUpdated = await recomputeAllTrees(db, now);
  // Đánh dấu để trang Văn bản không tính lại lần nữa trong ngày (ensureTreesFreshToday)
  await db.setting.upsert({
    where: { key: "progressRecomputedOn" },
    update: { value: vnDateKey(now) },
    create: { key: "progressRecomputedOn", value: vnDateKey(now) },
  });
  const trash = await purgeExpiredTrash(db, now);
  const { count: notificationsRemoved } = await db.notification.deleteMany({
    where: {
      readAt: { not: null },
      createdAt: { lt: new Date(now.getTime() - NOTIFICATION_KEEP_DAYS * 86_400_000) },
    },
  });
  return { nodesUpdated, trash, notificationsRemoved };
}
