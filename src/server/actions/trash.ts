"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";

import { withAuth } from "@/server/action";
import { clientIp } from "@/server/auth/current-user";
import { AppError } from "@/server/errors";
import { purgeAttachments, purgeDocumentBranches, removeStoredFiles } from "@/server/jobs/trash";

// Thùng rác (ADMIN): xoá vĩnh viễn ngay (không chờ 30 ngày) và khôi phục tệp đính kèm.
// Khôi phục văn bản dùng restoreDocument (src/server/actions/documents.ts).

const idOnly = z.object({ id: z.string().min(1) });
const REVALIDATE: Array<string | [string, "layout"]> = [
  "/quan-tri/thung-rac",
  ["/van-ban", "layout"],
];

export const purgeDocumentNow = withAuth(
  { permission: "trash.manage", schema: idOnly, revalidate: REVALIDATE },
  async ({ tx, input, user }) => {
    const node = await tx.documentNode.findUnique({
      where: { id: input.id },
      select: { deletedAt: true },
    });
    if (!node) throw new AppError("NOT_FOUND", "Văn bản không còn trong Thùng rác.");
    if (!node.deletedAt)
      throw new AppError("NOT_DELETED", "Chỉ xoá vĩnh viễn được văn bản đang ở Thùng rác.");
    const actor = { userId: user.id, ip: clientIp(await headers()) };
    const r = await purgeDocumentBranches(tx, [input.id], actor, "manual");
    // Xoá tệp trên ổ sau khi transaction đã ghi xong
    after(() => removeStoredFiles(r.storageKeys).then(() => undefined));
    return { documents: r.documents, attachments: r.attachments };
  },
);

export const purgeAttachmentNow = withAuth(
  { permission: "trash.manage", schema: idOnly, revalidate: REVALIDATE },
  async ({ tx, input, user }) => {
    const actor = { userId: user.id, ip: clientIp(await headers()) };
    const r = await purgeAttachments(tx, [input.id], actor, "manual");
    if (r.attachments === 0) throw new AppError("NOT_FOUND", "Tệp không còn trong Thùng rác.");
    after(() => removeStoredFiles(r.storageKeys).then(() => undefined));
    return { attachments: r.attachments };
  },
);

export const restoreAttachment = withAuth(
  { permission: "trash.manage", schema: idOnly, revalidate: REVALIDATE },
  async ({ tx, input, audit }) => {
    const a = await tx.attachment.findUnique({
      where: { id: input.id },
      select: {
        deletedAt: true,
        fileName: true,
        documentId: true,
        document: { select: { deletedAt: true } },
      },
    });
    if (!a?.deletedAt) throw new AppError("NOT_DELETED", "Tệp không ở Thùng rác.");
    if (a.document?.deletedAt)
      throw new AppError(
        "PARENT_DELETED",
        "Văn bản chứa tệp cũng đang ở Thùng rác — hãy khôi phục văn bản.",
      );
    await tx.attachment.update({ where: { id: input.id }, data: { deletedAt: null } });
    audit({
      action: "RESTORE",
      entity: "Attachment",
      entityId: input.id,
      after: { fileName: a.fileName, documentId: a.documentId },
    });
    return { documentId: a.documentId };
  },
);
