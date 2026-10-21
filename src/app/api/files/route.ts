import { revalidatePath } from "next/cache";

import { apiUser } from "@/server/auth/api";
import { clientIp } from "@/server/auth/current-user";
import { resolveUploadOwner, saveAttachment, type UploadOutcome } from "@/server/documents/files";

// POST /api/files — multipart: documentId | taskUpdateId | submissionId | commentId + một hoặc nhiều "file".
// Mỗi tệp kiểm tra độc lập.
export async function POST(request: Request) {
  const user = await apiUser("document.list");
  if (user instanceof Response) return user;

  const form = await request.formData().catch(() => null);
  const field = (name: string) => {
    const v = form?.get(name);
    return typeof v === "string" && v ? v : null;
  };
  const files = (form?.getAll("file") ?? []).filter((f): f is File => f instanceof File);
  if (files.length === 0)
    return Response.json({ message: "Vui lòng chọn tệp để tải lên." }, { status: 400 });
  const owner = await resolveUploadOwner(user, {
    documentId: field("documentId"),
    taskUpdateId: field("taskUpdateId"),
    submissionId: field("submissionId"),
    commentId: field("commentId"),
  });
  if (!owner)
    return Response.json(
      { message: "Bạn không có quyền đính kèm tệp vào mục này." },
      { status: 403 },
    );

  const ip = clientIp(request.headers);
  const results: UploadOutcome[] = [];
  for (const file of files) results.push(await saveAttachment(user, ip, owner, file));
  if (owner.documentId) revalidatePath(`/van-ban/${owner.documentId}`);
  revalidatePath("/cong-viec", "layout");
  revalidatePath("/bao-cao");
  const failed = results.filter((r) => !r.ok).length;
  return Response.json({ results }, { status: failed === results.length ? 422 : 200 });
}
