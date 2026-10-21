// Xoá vĩnh viễn khỏi Thùng rác: job đêm (quá 30 ngày) và nút "Xoá vĩnh viễn" của ADMIN dùng chung.
// Không "server-only" (worker dùng). Xoá bản ghi trong transaction, xoá tệp trên ổ SAU khi commit.
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { purgeCutoff } from "@/lib/trash";
import { removeFile } from "@/server/storage";

type Tx = Prisma.TransactionClient;
type Actor = { userId: string | null; ip: string | null };

export type PurgeResult = { documents: number; attachments: number; files: number };

const label = (n: { number: string | null; title: string }) =>
  n.number ? `${n.number} ${n.title}` : n.title;

/**
 * Xoá vĩnh viễn các nhánh văn bản (đã xoá mềm) có gốc trong `rootIds`.
 * Cả cây con bị xoá theo (mọi con cháu của nút đã xoá đều đang ở Thùng rác); yêu cầu báo cáo, kỳ, bản nộp,
 * tệp đính kèm xoá theo khoá ngoại CASCADE; công việc giữ lại và bỏ liên kết văn bản (SET NULL).
 * Trả về khoá lưu các tệp cần xoá trên ổ.
 */
export async function purgeDocumentBranches(
  tx: Tx,
  rootIds: readonly string[],
  actor: Actor,
  reason: "manual" | "expired",
): Promise<{ documents: number; attachments: number; storageKeys: string[] }> {
  if (rootIds.length === 0) return { documents: 0, attachments: 0, storageKeys: [] };
  const roots = await tx.documentNode.findMany({
    where: { id: { in: [...rootIds] }, deletedAt: { not: null } },
    select: { id: true, path: true, title: true, number: true, deletedAt: true },
  });
  const ids = new Set<string>();
  const perRoot = new Map<string, number>();
  for (const r of roots) {
    const branch = await tx.documentNode.findMany({
      where: { path: { startsWith: r.path } },
      select: { id: true, deletedAt: true },
    });
    // An toàn: không bao giờ xoá vĩnh viễn nút còn đang dùng
    if (branch.some((b) => !b.deletedAt)) continue;
    branch.forEach((b) => ids.add(b.id));
    perRoot.set(r.id, branch.length);
  }
  if (ids.size === 0) return { documents: 0, attachments: 0, storageKeys: [] };
  const docIds = [...ids];

  const attachments = await tx.attachment.findMany({
    where: {
      OR: [
        { documentId: { in: docIds } },
        { submission: { period: { requirement: { documentId: { in: docIds } } } } },
        { comment: { documentId: { in: docIds } } },
      ],
    },
    select: { storageKey: true },
  });
  const deleted = await tx.documentNode.deleteMany({ where: { id: { in: docIds } } });
  await tx.auditLog.createMany({
    data: roots
      .filter((r) => perRoot.has(r.id))
      .map((r) => ({
        userId: actor.userId,
        ip: actor.ip,
        action: "PURGE",
        entity: "DocumentNode",
        entityId: r.id,
        before: { title: label(r), deletedAt: r.deletedAt?.toISOString() },
        after: { reason, count: perRoot.get(r.id), attachments: attachments.length },
      })),
  });
  return {
    documents: deleted.count,
    attachments: attachments.length,
    storageKeys: attachments.map((a) => a.storageKey),
  };
}

/** Xoá vĩnh viễn tệp đính kèm đã xoá mềm (riêng lẻ) */
export async function purgeAttachments(
  tx: Tx,
  ids: readonly string[],
  actor: Actor,
  reason: "manual" | "expired",
): Promise<{ attachments: number; storageKeys: string[] }> {
  if (ids.length === 0) return { attachments: 0, storageKeys: [] };
  const rows = await tx.attachment.findMany({
    where: { id: { in: [...ids] }, deletedAt: { not: null } },
    select: { id: true, fileName: true, storageKey: true, documentId: true },
  });
  if (rows.length === 0) return { attachments: 0, storageKeys: [] };
  await tx.attachment.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
  await tx.auditLog.createMany({
    data: rows.map((r) => ({
      userId: actor.userId,
      ip: actor.ip,
      action: "PURGE",
      entity: "Attachment",
      entityId: r.id,
      before: { fileName: r.fileName, documentId: r.documentId },
      after: { reason },
    })),
  });
  return { attachments: rows.length, storageKeys: rows.map((r) => r.storageKey) };
}

/** Xoá tệp trên ổ — lỗi từng tệp chỉ ghi log (bản ghi CSDL đã xoá xong) */
export async function removeStoredFiles(keys: readonly string[]): Promise<number> {
  let removed = 0;
  for (const key of keys) {
    try {
      await removeFile(key);
      removed++;
    } catch (e) {
      console.error(`[Thùng rác] Không xoá được tệp ${key}:`, e);
    }
  }
  return removed;
}

/** Job đêm: xoá vĩnh viễn mọi thứ đã ở Thùng rác quá 30 ngày */
export async function purgeExpiredTrash(db: PrismaClient, now = new Date()): Promise<PurgeResult> {
  const cutoff = purgeCutoff(now);
  const actor = { userId: null, ip: null };
  const { docs, files } = await db.$transaction(async (tx) => {
    // Tập nút hết hạn đóng theo con cháu (con xoá cùng lúc hoặc trước cha) → lấy các nút có cha không hết hạn
    const expired = await tx.documentNode.findMany({
      where: { deletedAt: { lt: cutoff } },
      select: { id: true, parentId: true },
    });
    const expiredIds = new Set(expired.map((e) => e.id));
    const roots = expired
      .filter((e) => !e.parentId || !expiredIds.has(e.parentId))
      .map((e) => e.id);
    const docs = await purgeDocumentBranches(tx, roots, actor, "expired");
    const loose = await tx.attachment.findMany({
      where: { deletedAt: { lt: cutoff } },
      select: { id: true },
    });
    const att = await purgeAttachments(
      tx,
      loose.map((a) => a.id),
      actor,
      "expired",
    );
    return {
      docs: { documents: docs.documents, attachments: docs.attachments + att.attachments },
      files: [...docs.storageKeys, ...att.storageKeys],
    };
  });
  return { ...docs, files: await removeStoredFiles(files) };
}
