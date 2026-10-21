// Thùng rác (Mục 4.4): giữ 30 ngày rồi job đêm xoá vĩnh viễn. Hàm thuần, có unit test.
import { daysUntil, vnDateKey } from "@/lib/format";

export const TRASH_RETENTION_DAYS = 30;
const MS_PER_DAY = 86_400_000;

/** Mục xoá trước mốc này đã quá hạn giữ → xoá vĩnh viễn */
export function purgeCutoff(now: Date, retentionDays = TRASH_RETENTION_DAYS): Date {
  return new Date(now.getTime() - retentionDays * MS_PER_DAY);
}

export function isPurgeDue(deletedAt: Date, now: Date, retentionDays = TRASH_RETENTION_DAYS) {
  return deletedAt < purgeCutoff(now, retentionDays);
}

/** Thời điểm hết hạn giữ (job đêm sau mốc này sẽ xoá) */
export function purgeAt(deletedAt: Date, retentionDays = TRASH_RETENTION_DAYS): Date {
  return new Date(deletedAt.getTime() + retentionDays * MS_PER_DAY);
}

/** Số ngày còn lại trong Thùng rác (theo ngày giờ VN), không âm */
export function daysLeftInTrash(
  deletedAt: Date,
  now: Date,
  retentionDays = TRASH_RETENTION_DAYS,
): number {
  // daysUntil làm việc với ngày thuần → đổi mốc hết hạn sang ngày VN
  const endKey = vnDateKey(purgeAt(deletedAt, retentionDays));
  return Math.max(0, daysUntil(new Date(`${endKey}T00:00:00Z`), now));
}

/**
 * Các nút "gốc" của mỗi lần xoá: cha không bị xoá, hoặc bị xoá ở lần khác (mốc deletedAt khác).
 * Khôi phục / xoá vĩnh viễn một gốc = cả nhánh xoá cùng lúc với nó.
 */
export function deletionRoots<T extends { id: string; parentId: string | null; deletedAt: Date }>(
  deleted: readonly T[],
): T[] {
  const byId = new Map(deleted.map((d) => [d.id, d]));
  return deleted.filter((d) => {
    const parent = d.parentId ? byId.get(d.parentId) : undefined;
    return !parent || parent.deletedAt.getTime() !== d.deletedAt.getTime();
  });
}
