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
  documentId: string,
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
          documentId,
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
        after: { documentId, fileName: created.fileName, sizeBytes: created.sizeBytes },
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
