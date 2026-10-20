"use client";

import { Download, Eye, FileUp, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ACCEPT_ATTRIBUTE, formatFileSize, isPreviewable } from "@/lib/file-type";

import { SecretWarning } from "./SecretWarning";
import { uploadOne } from "./upload";

export type AttachmentRow = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
  createdAt: string;
};

type Progress = { name: string; percent: number; error?: string };

export function FilesTab({
  documentId,
  files,
  canEdit,
}: {
  documentId: string;
  files: AttachmentRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const inputId = useId();
  const [preview, setPreview] = useState<AttachmentRow | null>(null);
  const [deleting, setDeleting] = useState<AttachmentRow | null>(null);
  const [progress, setProgress] = useState<Progress[]>([]);

  async function upload(list: File[]) {
    setProgress(list.map((f) => ({ name: f.name, percent: 0 })));
    let ok = 0;
    for (const [i, f] of list.entries()) {
      const r = await uploadOne(documentId, f, (percent) =>
        setProgress((p) => p.map((x, j) => (j === i ? { ...x, percent } : x))),
      );
      if (r.ok) ok++;
      else setProgress((p) => p.map((x, j) => (j === i ? { ...x, error: r.message } : x)));
    }
    if (ok > 0) toast.success(`Đã tải lên ${ok} tệp.`);
    setProgress((p) => p.filter((x) => x.error));
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {canEdit && (
        <div className="flex flex-col gap-2 rounded-xl border border-dashed p-4">
          <SecretWarning />
          <div className="flex flex-wrap items-center gap-3">
            <label
              htmlFor={inputId}
              className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-brand px-4 font-medium text-white hover:bg-brand/90"
            >
              <FileUp className="size-5" aria-hidden />
              Tải tệp lên
            </label>
            <input
              id={inputId}
              type="file"
              multiple
              accept={ACCEPT_ATTRIBUTE}
              className="sr-only"
              onChange={(e) => {
                const list = Array.from(e.target.files ?? []);
                e.target.value = "";
                if (list.length) void upload(list);
              }}
            />
            <span className="text-muted-foreground">
              PDF, DOC, DOCX, XLS, XLSX, JPG, PNG — tối đa 20 MB mỗi tệp.
            </span>
          </div>
          {progress.length > 0 && (
            <ul className="flex flex-col gap-1" aria-live="polite">
              {progress.map((p, i) => (
                <li key={i} className="flex flex-col gap-1">
                  <span className={p.error ? "text-destructive" : undefined}>
                    {p.error ?? `${p.name} — ${p.percent}%`}
                  </span>
                  {!p.error && (
                    <span className="h-2 overflow-hidden rounded-full bg-muted">
                      <span
                        className="block h-full bg-brand transition-all"
                        style={{ width: `${p.percent}%` }}
                      />
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {files.length === 0 ? (
        <p className="text-muted-foreground">Chưa có tệp đính kèm.</p>
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border">
          {files.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{f.fileName}</p>
                <p className="text-sm text-muted-foreground">
                  {formatFileSize(f.sizeBytes)} · {f.uploadedBy} · {f.createdAt}
                </p>
              </div>
              {isPreviewable(f.mimeType) && (
                <Button variant="outline" size="sm" onClick={() => setPreview(f)}>
                  <Eye aria-hidden />
                  Xem
                </Button>
              )}
              <Button variant="outline" size="sm" asChild>
                <a href={`/api/files/${f.id}?tai=1`} download>
                  <Download aria-hidden />
                  Tải về
                </a>
              </Button>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-destructive"
                  onClick={() => setDeleting(f)}
                  aria-label={`Xoá tệp ${f.fileName}`}
                >
                  <Trash2 aria-hidden />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="h-[90dvh] max-w-[95vw] grid-rows-[auto_1fr] sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle className="truncate pr-8">{preview?.fileName}</DialogTitle>
            <DialogDescription className="sr-only">Xem trước tệp đính kèm</DialogDescription>
          </DialogHeader>
          {preview &&
            (preview.mimeType === "application/pdf" ? (
              <iframe
                src={`/api/files/${preview.id}`}
                title={`Xem trước ${preview.fileName}`}
                className="h-full w-full rounded-lg border"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- ảnh phục vụ qua API có kiểm tra quyền
              <img
                src={`/api/files/${preview.id}`}
                alt={preview.fileName}
                className="mx-auto max-h-full object-contain"
              />
            ))}
        </DialogContent>
      </Dialog>

      {deleting && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setDeleting(null)}
          title={`Xoá tệp “${deleting.fileName}”?`}
          description="Tệp sẽ không còn hiển thị trong văn bản (vẫn lưu trong nhật ký hệ thống)."
          onConfirm={async () => {
            const res = await fetch(`/api/files/${deleting.id}`, { method: "DELETE" });
            if (res.ok) return { ok: true, data: null };
            const data = (await res.json().catch(() => ({}))) as { message?: string };
            return {
              ok: false,
              error: { code: String(res.status), message: data.message ?? "Không xoá được tệp." },
            };
          }}
          successMessage="Đã xoá tệp."
          onSuccess={() => router.refresh()}
        />
      )}
    </div>
  );
}
