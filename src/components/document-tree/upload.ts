// Tải tệp đính kèm lên /api/files — mỗi tệp một yêu cầu để có tiến độ và lỗi riêng.

export type UploadResult =
  { ok: true; fileName: string } | { ok: false; fileName: string; message: string };

export function uploadOne(
  documentId: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<UploadResult> {
  return new Promise((resolve) => {
    const body = new FormData();
    body.set("documentId", documentId);
    body.append("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/files");
    xhr.upload.onprogress = (e) =>
      e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText) as {
          results?: ({ ok: true } | { ok: false; message: string })[];
          message?: string;
        };
        const r = data.results?.[0];
        if (r?.ok) resolve({ ok: true, fileName: file.name });
        else
          resolve({
            ok: false,
            fileName: file.name,
            message: (r && !r.ok && r.message) || data.message || "Không tải lên được tệp.",
          });
      } catch {
        resolve({ ok: false, fileName: file.name, message: `Không tải lên được “${file.name}”.` });
      }
    };
    xhr.onerror = () =>
      resolve({
        ok: false,
        fileName: file.name,
        message: `Mất kết nối khi tải “${file.name}”. Vui lòng thử lại.`,
      });
    xhr.send(body);
  });
}

export async function uploadMany(documentId: string, files: File[]): Promise<UploadResult[]> {
  const results: UploadResult[] = [];
  for (const f of files) results.push(await uploadOne(documentId, f));
  return results;
}
