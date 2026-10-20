import { revalidatePath } from "next/cache";

import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { isPreviewable } from "@/lib/file-type";
import { apiUser } from "@/server/auth/api";
import { clientIp } from "@/server/auth/current-user";
import { canEditDocument, canViewDocument } from "@/server/documents/files";
import { fileStream } from "@/server/storage";

async function findAttachment(id: string) {
  const a = await db.attachment.findUnique({ where: { id } });
  return a && !a.deletedAt && a.documentId ? a : null;
}

function contentDisposition(kind: "inline" | "attachment", fileName: string) {
  const ascii = fileName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .replace(/[^\w.-]+/g, "_");
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

// GET /api/files/:id — kiểm tra quyền xem văn bản, ghi nhật ký; ?tai=1 để tải về thay vì xem trước
export async function GET(request: Request, { params }: RouteContext<"/api/files/[id]">) {
  const user = await apiUser("document.list");
  if (user instanceof Response) return user;
  const { id } = await params;
  const attachment = await findAttachment(id);
  if (!attachment || !(await canViewDocument(user, attachment.documentId!))) {
    return Response.json(
      { message: "Không tìm thấy tệp hoặc bạn không có quyền xem." },
      { status: 404 },
    );
  }
  const file = await fileStream(attachment.storageKey);
  if (!file)
    return Response.json(
      { message: "Tệp không còn trên máy chủ. Vui lòng báo quản trị viên." },
      { status: 410 },
    );

  const download =
    new URL(request.url).searchParams.get("tai") === "1" || !isPreviewable(attachment.mimeType);
  await audit(db, user.id, clientIp(request.headers), {
    action: "DOWNLOAD",
    entity: "Attachment",
    entityId: id,
    after: {
      documentId: attachment.documentId,
      fileName: attachment.fileName,
      mode: download ? "download" : "preview",
    },
  });
  return new Response(file.stream, {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Length": String(file.size),
      "Content-Disposition": contentDisposition(
        download ? "attachment" : "inline",
        attachment.fileName,
      ),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}

// DELETE /api/files/:id — xoá mềm tệp đính kèm
export async function DELETE(request: Request, { params }: RouteContext<"/api/files/[id]">) {
  const user = await apiUser("document.list");
  if (user instanceof Response) return user;
  const { id } = await params;
  const attachment = await findAttachment(id);
  if (!attachment || !(await canEditDocument(user, attachment.documentId!))) {
    return Response.json(
      { message: "Không tìm thấy tệp hoặc bạn không có quyền xoá." },
      { status: 404 },
    );
  }
  await db.$transaction(async (tx) => {
    await tx.attachment.update({ where: { id }, data: { deletedAt: new Date() } });
    await audit(tx, user.id, clientIp(request.headers), {
      action: "DELETE",
      entity: "Attachment",
      entityId: id,
      before: { documentId: attachment.documentId, fileName: attachment.fileName },
    });
  });
  revalidatePath(`/van-ban/${attachment.documentId}`);
  return Response.json({ ok: true });
}
