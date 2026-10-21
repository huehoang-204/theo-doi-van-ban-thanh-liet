// Tính lại tiến độ cộng dồn & chấm đỏ cho cây văn bản (Mục 3.4, 13.1).
// Không đánh dấu "server-only" vì seed/worker cũng dùng; luôn nhận client Prisma từ ngoài.
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { vnDateKey } from "@/lib/format";
import { rollUpProgress } from "@/lib/progress";

type Db = Prisma.TransactionClient | PrismaClient;

/** Tính lại cho các cây (theo id chương trình gốc) — gọi sau mọi thay đổi công việc/cấu trúc cây */
export async function recomputeTrees(
  db: Db,
  rootIds: Iterable<string | null | undefined>,
  now = new Date(),
): Promise<number> {
  const roots = [...new Set([...rootIds].filter((r): r is string => !!r))];
  if (roots.length === 0) return 0;
  const nodes = await db.documentNode.findMany({
    where: { deletedAt: null, OR: [{ id: { in: roots } }, { rootId: { in: roots } }] },
    select: { id: true, parentId: true, progressCache: true, hasOverdueDescendant: true },
  });
  const tasks = await db.task.findMany({
    where: { deletedAt: null, documentId: { in: nodes.map((n) => n.id) } },
    select: {
      documentId: true,
      progress: true,
      flow: true,
      dueDate: true,
      completedAt: true,
      submittedAt: true,
    },
  });
  const result = rollUpProgress(nodes, tasks, now);
  const changed = nodes.filter((n) => {
    const r = result.get(n.id)!;
    return r.progress !== n.progressCache || r.hasOverdue !== n.hasOverdueDescendant;
  });
  if (changed.length === 0) return 0;
  await db.$executeRaw`
    UPDATE "DocumentNode" AS d SET "progressCache" = u.progress, "hasOverdueDescendant" = u.overdue
    FROM unnest(${changed.map((n) => n.id)}::text[], ${changed.map((n) => result.get(n.id)!.progress)}::int[],
                ${changed.map((n) => result.get(n.id)!.hasOverdue)}::boolean[]) AS u(id, progress, overdue)
    WHERE d."id" = u.id`;
  return changed.length;
}

/** Id chương trình gốc của các văn bản */
export async function rootsOf(
  db: Db,
  documentIds: Iterable<string | null | undefined>,
): Promise<string[]> {
  const ids = [...new Set([...documentIds].filter((d): d is string => !!d))];
  if (ids.length === 0) return [];
  const rows = await db.documentNode.findMany({
    where: { id: { in: ids } },
    select: { id: true, rootId: true },
  });
  return rows.map((r) => r.rootId ?? r.id);
}

export async function recomputeAllTrees(db: Db, now = new Date()): Promise<number> {
  const roots = await db.documentNode.findMany({
    where: { parentId: null, deletedAt: null },
    select: { id: true },
  });
  return recomputeTrees(
    db,
    roots.map((r) => r.id),
    now,
  );
}

/**
 * Việc trở thành "quá hạn" theo thời gian (không có thao tác nào) → mỗi ngày tính lại toàn bộ một lần.
 * Worker 06:30 (GĐ5) gọi hàm này; trang Văn bản cũng gọi để không phụ thuộc worker.
 */
export async function ensureTreesFreshToday(db: PrismaClient, now = new Date()): Promise<void> {
  const today = vnDateKey(now);
  const mark = await db.setting.findUnique({ where: { key: "progressRecomputedOn" } });
  if (mark?.value === today) return;
  await recomputeAllTrees(db, now);
  await db.setting.upsert({
    where: { key: "progressRecomputedOn" },
    update: { value: today },
    create: { key: "progressRecomputedOn", value: today },
  });
}
