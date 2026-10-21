import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { detectFileType, formatFileSize } from "@/lib/file-type";
import { can } from "@/lib/permissions";
import type { CurrentUser } from "@/server/auth/current-user";
import { documentResourceOf } from "@/server/documents/queries";
import { getSetting } from "@/server/queries/catalog";
import { putFile, removeFile, storageKeyFor } from "@/server/storage";
import { periodScopeWhere } from "@/server/reports/queries";
import { taskResourceOf, taskScopeWhere } from "@/server/tasks/queries";

export type UploadOutcome =
  | { ok: true; attachment: { id: string; fileName: string; sizeBytes: number; mimeType: string } }
  | { ok: false; fileName: string; message: string };

/** Văn bản kèm thông tin để xét quyền xem/sửa */
export async function documentForAccess(documentId: string) {
  return db.documentNode.findUnique({
    where: { id: documentId },
    include: {
      field: { select: { name: true } },
      shares: { select: { userId: true } },
      tasks: {
        where: { deletedAt: null },
        select: {
          leadUserId: true,
          coUserIds: true,
          leadDepartmentId: true,
          coDepartmentIds: true,
        },
      },
    },
  });
}

/** Lưu một tệp đính kèm: kiểm tra kích thước + magic bytes, lưu theo id, ghi checksum và nhật ký */
export async function saveAttachment(
  user: CurrentUser,
  ip: string | null,
  owner: AttachmentOwner,
  file: File,
): Promise<UploadOutcome> {
  const maxMB = await getSetting("maxUploadMB", 20);
  if (file.size === 0)
    return { ok: false, fileName: file.name, message: `Tệp “${file.name}” rỗng.` };
  if (file.size > maxMB * 1024 * 1024) {
    return {
      ok: false,
      fileName: file.name,
      message: `Tệp “${file.name}” (${formatFileSize(file.size)}) vượt quá giới hạn ${maxMB} MB.`,
    };
  }
  const data = new Uint8Array(await file.arrayBuffer());
  const detected = detectFileType(data.subarray(0, 256 * 1024), file.name);
  if (!detected.ok) return { ok: false, fileName: file.name, message: detected.message };

  const id = randomUUID();
  const storageKey = storageKeyFor(id);
  await putFile(storageKey, data);
  try {
    const attachment = await db.$transaction(async (tx) => {
      const created = await tx.attachment.create({
        data: {
          id,
          documentId: owner.documentId,
          taskUpdateId: owner.taskUpdateId ?? null,
          submissionId: owner.submissionId ?? null,
          commentId: owner.commentId ?? null,
          fileName: file.name.slice(0, 255),
          storageKey,
          mimeType: detected.mimeType,
          sizeBytes: data.byteLength,
          checksum: createHash("sha256").update(data).digest("hex"),
          uploadedById: user.id,
        },
      });
      await audit(tx, user.id, ip, {
        action: "CREATE",
        entity: "Attachment",
        entityId: id,
        after: { ...owner, fileName: created.fileName, sizeBytes: created.sizeBytes },
      });
      return created;
    });
    return {
      ok: true,
      attachment: {
        id,
        fileName: attachment.fileName,
        sizeBytes: attachment.sizeBytes,
        mimeType: attachment.mimeType,
      },
    };
  } catch (error) {
    await removeFile(storageKey); // không để tệp mồ côi khi ghi CSDL lỗi
    throw error;
  }
}

export async function canEditDocument(user: CurrentUser, documentId: string): Promise<boolean> {
  const doc = await documentForAccess(documentId);
  return !!doc && !doc.deletedAt && can(user, "document.update", documentResourceOf(doc));
}

export async function canViewDocument(user: CurrentUser, documentId: string): Promise<boolean> {
  const doc = await documentForAccess(documentId);
  return !!doc && !doc.deletedAt && can(user, "document.view", documentResourceOf(doc));
}

// ---------------------------------------------------------------- Chủ sở hữu tệp: văn bản / minh chứng / bản nộp báo cáo

export type AttachmentOwner = {
  documentId: string | null;
  taskUpdateId?: string;
  submissionId?: string;
  commentId?: string;
};

/**
 * Xác định nơi gắn tệp tải lên và kiểm tra quyền ghi:
 *  - documentId: sửa được văn bản
 *  - taskUpdateId (minh chứng tiến độ): được cập nhật tiến độ công việc đó
 *  - submissionId (tệp báo cáo): được nộp báo cáo cho đơn vị; tệp gắn luôn vào văn bản con tự tạo
 *  - commentId (tệp trong thảo luận): người viết bình luận, khi còn xem được văn bản
 */
export async function resolveUploadOwner(
  user: CurrentUser,
  target: {
    documentId?: string | null;
    taskUpdateId?: string | null;
    submissionId?: string | null;
    commentId?: string | null;
  },
): Promise<AttachmentOwner | null> {
  if (target.commentId) {
    const c = await db.documentComment.findUnique({ where: { id: target.commentId } });
    if (!c || c.deletedAt || c.userId !== user.id) return null;
    return (await canViewDocument(user, c.documentId))
      ? { documentId: null, commentId: c.id }
      : null;
  }
  if (target.taskUpdateId) {
    const update = await db.taskUpdate.findUnique({
      where: { id: target.taskUpdateId },
      include: { task: true },
    });
    if (!update || update.task.deletedAt) return null;
    const allowed =
      update.userId === user.id || can(user, "task.updateProgress", taskResourceOf(update.task));
    return allowed ? { documentId: null, taskUpdateId: update.id } : null;
  }
  if (target.submissionId) {
    const sub = await db.reportSubmission.findUnique({
      where: { id: target.submissionId },
      include: { period: true },
    });
    if (!sub || !can(user, "report.submit", { departmentId: sub.period.departmentId })) return null;
    return { documentId: sub.linkedDocumentId, submissionId: sub.id };
  }
  if (target.documentId && (await canEditDocument(user, target.documentId)))
    return { documentId: target.documentId };
  return null;
}

/** Quyền xem tệp theo chủ sở hữu */
export async function canViewAttachment(
  user: CurrentUser,
  a: {
    documentId: string | null;
    taskUpdateId: string | null;
    submissionId: string | null;
    commentId?: string | null;
  },
): Promise<boolean> {
  if (a.documentId && (await canViewDocument(user, a.documentId))) return true;
  if (a.commentId) {
    const c = await db.documentComment.findUnique({
      where: { id: a.commentId },
      select: { documentId: true, deletedAt: true },
    });
    if (c && !c.deletedAt && (await canViewDocument(user, c.documentId))) return true;
  }
  if (a.taskUpdateId) {
    const scope = taskScopeWhere(user);
    const found = await db.task.findFirst({
      where: {
        updates: { some: { id: a.taskUpdateId } },
        deletedAt: null,
        ...(scope ? { AND: [scope] } : {}),
      },
      select: { id: true },
    });
    if (found) return true;
  }
  if (a.submissionId) {
    const scope = periodScopeWhere(user);
    const found = await db.reportPeriod.findFirst({
      where: { submission: { id: a.submissionId }, ...(scope ? { AND: [scope] } : {}) },
      select: { id: true },
    });
    if (found) return true;
  }
  return false;
}
