import { revalidatePath } from "next/cache";

import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { isPreviewable } from "@/lib/file-type";
import { apiUser } from "@/server/auth/api";
import { clientIp } from "@/server/auth/current-user";
import { canEditDocument, canViewAttachment } from "@/server/documents/files";
import { fileStream } from "@/server/storage";

async function findAttachment(id: string) {
  const a = await db.attachment.findUnique({ where: { id } });
  return a && !a.deletedAt ? a : null;
}

function contentDisposition(kind: "inline" | "attachment", fileName: string) {
  const ascii = fileName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .replace(/[^\w.-]+/g, "_");
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

// GET /api/files/:id — kiểm tra quyền xem văn bản, ghi nhật ký; ?tai=1 để tải về thay vì xem trước, ?xem=1 lấy dữ liệu để xem trước DOCX/XLSX
export async function GET(request: Request, { params }: RouteContext<"/api/files/[id]">) {
  const user = await apiUser("document.list");
  if (user instanceof Response) return user;
  const { id } = await params;
  const attachment = await findAttachment(id);
  if (!attachment || !(await canViewAttachment(user, attachment))) {
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

  // ?tai=1: tải về. ?xem=1: trình duyệt tự dựng bản xem trước (DOCX/XLSX) — tính là "xem", không phải "tải"
  const query = new URL(request.url).searchParams;
  const download = query.get("tai") === "1" || !isPreviewable(attachment.mimeType);
  const mode =
    query.get("tai") !== "1" && (!download || query.get("xem") === "1") ? "preview" : "download";
  const documentId =
    attachment.documentId ??
    (attachment.commentId
      ? (
          await db.documentComment.findUnique({
            where: { id: attachment.commentId },
            select: { documentId: true },
          })
        )?.documentId
      : null) ??
    null;
  await audit(db, user.id, clientIp(request.headers), {
    action: "DOWNLOAD",
    entity: "Attachment",
    entityId: id,
    after: { documentId, fileName: attachment.fileName, mode },
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
  if (
    !attachment ||
    !attachment.documentId ||
    attachment.taskUpdateId ||
    !(await canEditDocument(user, attachment.documentId))
  ) {
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
