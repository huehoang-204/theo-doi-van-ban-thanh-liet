import { revalidatePath } from "next/cache";

import { apiUser } from "@/server/auth/api";
import { clientIp } from "@/server/auth/current-user";
import { canEditDocument, saveAttachment, type UploadOutcome } from "@/server/documents/files";

// POST /api/files — multipart: documentId + một hoặc nhiều "file". Mỗi tệp kiểm tra độc lập.
export async function POST(request: Request) {
  const user = await apiUser("document.list");
  if (user instanceof Response) return user;

  const form = await request.formData().catch(() => null);
  const documentId = form?.get("documentId");
  const files = (form?.getAll("file") ?? []).filter((f): f is File => f instanceof File);
  if (typeof documentId !== "string" || files.length === 0) {
    return Response.json({ message: "Vui lòng chọn tệp để tải lên." }, { status: 400 });
  }
  if (!(await canEditDocument(user, documentId))) {
    return Response.json(
      { message: "Bạn không có quyền đính kèm tệp cho văn bản này." },
      { status: 403 },
    );
  }

  const ip = clientIp(request.headers);
  const results: UploadOutcome[] = [];
  for (const file of files) results.push(await saveAttachment(user, ip, documentId, file));
  revalidatePath(`/van-ban/${documentId}`);
  const failed = results.filter((r) => !r.ok).length;
  return Response.json({ results }, { status: failed === results.length ? 422 : 200 });
}
