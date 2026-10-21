import "server-only";

// Thùng rác (Mục 4.4): văn bản đã xoá mềm (theo từng lần xoá) và tệp đính kèm xoá riêng lẻ.
import { db } from "@/lib/db";
import { daysLeftInTrash, deletionRoots, purgeAt } from "@/lib/trash";
import { lastRun, type JobRecord } from "@/server/jobs/runner";

export type TrashDocument = {
  id: string;
  number: string | null;
  title: string;
  typeName: string;
  typeColor: string;
  /** Nằm dưới (chuỗi văn bản cha) — rỗng nếu là chương trình */
  trail: string;
  branchCount: number;
  attachmentCount: number;
  requirementCount: number;
  deletedAt: Date;
  deletedBy: string | null;
  purgeAt: Date;
  daysLeft: number;
  /** Văn bản cha cũng đang ở Thùng rác (khôi phục cha trước) */
  parentDeleted: boolean;
};

export type TrashAttachment = {
  id: string;
  fileName: string;
  sizeBytes: number;
  documentId: string;
  documentLabel: string;
  deletedAt: Date;
  deletedBy: string | null;
  purgeAt: Date;
  daysLeft: number;
};

async function deletedByMap(entity: string, ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const logs = await db.auditLog.findMany({
    where: { entity, action: "DELETE", entityId: { in: ids } },
    orderBy: { createdAt: "desc" },
    select: { entityId: true, user: { select: { fullName: true } } },
  });
  const map = new Map<string, string>();
  for (const l of logs)
    if (l.entityId && l.user && !map.has(l.entityId)) map.set(l.entityId, l.user.fullName);
  return map;
}

const label = (n: { number: string | null; title: string }) =>
  n.number ?? (n.title.length > 50 ? `${n.title.slice(0, 49)}…` : n.title);

export async function listTrash(now = new Date()): Promise<{
  documents: TrashDocument[];
  attachments: TrashAttachment[];
  jobs: { daily: JobRecord | null; nightly: JobRecord | null };
}> {
  const deleted = await db.documentNode.findMany({
    where: { deletedAt: { not: null } },
    orderBy: { deletedAt: "desc" },
    select: {
      id: true,
      parentId: true,
      path: true,
      number: true,
      title: true,
      deletedAt: true,
      type: { select: { name: true, color: true } },
    },
  });
  const roots = deletionRoots(deleted.map((d) => ({ ...d, deletedAt: d.deletedAt! })));
  const ancestorIds = [
    ...new Set(roots.flatMap((r) => r.path.split("/").filter(Boolean).slice(0, -1))),
  ];
  const [ancestors, deletedBy, attachmentsByDoc, requirementsByDoc] = await Promise.all([
    db.documentNode.findMany({
      where: { id: { in: ancestorIds } },
      select: { id: true, number: true, title: true, deletedAt: true },
    }),
    deletedByMap(
      "DocumentNode",
      roots.map((r) => r.id),
    ),
    db.attachment.groupBy({
      by: ["documentId"],
      where: { documentId: { in: deleted.map((d) => d.id) } },
      _count: true,
    }),
    db.reportRequirement.groupBy({
      by: ["documentId"],
      where: { documentId: { in: deleted.map((d) => d.id) } },
      _count: true,
    }),
  ]);
  const anc = new Map(ancestors.map((a) => [a.id, a]));
  const attCount = new Map(attachmentsByDoc.map((a) => [a.documentId, a._count]));
  const reqCount = new Map(requirementsByDoc.map((a) => [a.documentId, a._count]));

  const documents = roots.map((r): TrashDocument => {
    const branch = deleted.filter((d) => d.path.startsWith(r.path));
    const parent = r.parentId ? anc.get(r.parentId) : undefined;
    return {
      id: r.id,
      number: r.number,
      title: r.title,
      typeName: r.type.name,
      typeColor: r.type.color,
      trail: r.path
        .split("/")
        .filter(Boolean)
        .slice(0, -1)
        .map((id) => (anc.get(id) ? label(anc.get(id)!) : "…"))
        .join(" › "),
      branchCount: branch.length,
      attachmentCount: branch.reduce((s, d) => s + (attCount.get(d.id) ?? 0), 0),
      requirementCount: branch.reduce((s, d) => s + (reqCount.get(d.id) ?? 0), 0),
      deletedAt: r.deletedAt,
      deletedBy: deletedBy.get(r.id) ?? null,
      purgeAt: purgeAt(r.deletedAt),
      daysLeft: daysLeftInTrash(r.deletedAt, now),
      parentDeleted: !!parent?.deletedAt,
    };
  });

  // Tệp xoá riêng lẻ (văn bản chứa nó vẫn còn) — tệp của văn bản đã xoá đi cùng văn bản
  const files = await db.attachment.findMany({
    where: { deletedAt: { not: null }, document: { deletedAt: null } },
    orderBy: { deletedAt: "desc" },
    select: {
      id: true,
      fileName: true,
      sizeBytes: true,
      deletedAt: true,
      documentId: true,
      document: { select: { number: true, title: true } },
    },
  });
  const fileDeletedBy = await deletedByMap(
    "Attachment",
    files.map((f) => f.id),
  );
  const attachments = files.map((f): TrashAttachment => ({
    id: f.id,
    fileName: f.fileName,
    sizeBytes: f.sizeBytes,
    documentId: f.documentId!,
    documentLabel: f.document ? label(f.document) : "—",
    deletedAt: f.deletedAt!,
    deletedBy: fileDeletedBy.get(f.id) ?? null,
    purgeAt: purgeAt(f.deletedAt!),
    daysLeft: daysLeftInTrash(f.deletedAt!, now),
  }));

  const [daily, nightly] = await Promise.all([lastRun(db, "daily"), lastRun(db, "nightly")]);
  return { documents, attachments, jobs: { daily, nightly } };
}
