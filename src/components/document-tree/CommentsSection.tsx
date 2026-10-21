"use client";

import { Download, Eye, Paperclip, Send, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { FilePreview, type PreviewFile } from "@/components/common/FilePreview";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ACCEPT_ATTRIBUTE, formatFileSize, previewKind } from "@/lib/file-type";
import { formatDateTime, formatTimeAgo } from "@/lib/format";
import { MAX_COMMENT_LENGTH } from "@/lib/schemas/publish";
import { addComment, deleteComment } from "@/server/actions/publishing";

import { Avatar } from "./DocumentPeople";
import { uploadOne } from "./upload";

export type CommentRow = {
  id: string;
  content: string;
  createdAt: string;
  author: { id: string; fullName: string; detail: string | null };
  mine: boolean;
  canDelete: boolean;
  attachments: { id: string; fileName: string; sizeBytes: number; mimeType: string }[];
};

/** Thảo luận trên văn bản: người xem được văn bản đều viết được; người theo dõi được báo */
export function CommentsSection({
  documentId,
  comments,
}: {
  documentId: string;
  comments: CommentRow[];
}) {
  const router = useRouter();
  const inputId = useId();
  const fileId = useId();
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [deleting, setDeleting] = useState<CommentRow | null>(null);
  const [preview, setPreview] = useState<PreviewFile | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) {
      setError("Hãy nhập nội dung thảo luận.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await addComment({ documentId, content });
      if (!r.ok) {
        setError(r.error.fieldErrors?.content ?? r.error.message);
        return;
      }
      const failed: string[] = [];
      for (const f of files) {
        const up = await uploadOne({ commentId: r.data.id }, f);
        if (!up.ok) failed.push(up.message);
      }
      if (failed.length) toast.error(failed.join(" "));
      else toast.success("Đã gửi thảo luận.");
      setContent("");
      setFiles([]);
      router.refresh();
    });
  }

  return (
    <section id="thao-luan" aria-labelledby={`${inputId}-h`} className="scroll-mt-24">
      <h3 id={`${inputId}-h`} className="mb-3 text-lg font-bold">
        Thảo luận ({comments.length})
      </h3>

      <form onSubmit={submit} className="rounded-xl border bg-muted/30 p-3">
        <label htmlFor={inputId} className="sr-only">
          Nội dung thảo luận
        </label>
        <Textarea
          id={inputId}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Viết thảo luận của bạn…"
          rows={3}
          maxLength={MAX_COMMENT_LENGTH}
          aria-invalid={!!error}
          className="bg-card"
        />
        {files.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Tệp sẽ đính kèm">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`}>
                <button
                  type="button"
                  onClick={() => setFiles((list) => list.filter((_, j) => j !== i))}
                  className="inline-flex items-center gap-1 rounded-full bg-card px-2.5 py-1 text-sm ring-1 ring-border"
                  aria-label={`Bỏ tệp ${f.name}`}
                >
                  <Paperclip className="size-3.5" aria-hidden />
                  {f.name} · {formatFileSize(f.size)}
                  <X className="size-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        {error && (
          <p className="mt-2 text-destructive" role="alert">
            {error}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <label
            htmlFor={fileId}
            className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg px-2 font-medium text-brand hover:bg-brand-soft"
          >
            <Paperclip className="size-4" aria-hidden />
            Đính kèm tệp
          </label>
          <input
            id={fileId}
            type="file"
            multiple
            accept={ACCEPT_ATTRIBUTE}
            className="sr-only"
            onChange={(e) => {
              const list = Array.from(e.target.files ?? []);
              e.target.value = "";
              setFiles((f) => [...f, ...list]);
            }}
          />
          <Button type="submit" disabled={pending}>
            <Send aria-hidden />
            {pending ? "Đang gửi…" : "Gửi thảo luận"}
          </Button>
        </div>
      </form>

      {comments.length === 0 ? (
        <p className="mt-4 text-muted-foreground">Chưa có thảo luận nào.</p>
      ) : (
        <ol className="mt-4 flex flex-col gap-4">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-3">
              <Avatar name={c.author.fullName} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-semibold">{c.author.fullName}</span>
                  {c.author.detail && (
                    <span className="text-sm text-muted-foreground">{c.author.detail}</span>
                  )}
                  <span
                    className="text-sm text-muted-foreground"
                    title={formatDateTime(new Date(c.createdAt))}
                    suppressHydrationWarning
                  >
                    · {formatTimeAgo(c.createdAt)}
                  </span>
                  {c.canDelete && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="ml-auto text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleting(c)}
                      aria-label="Xoá thảo luận này"
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  )}
                </div>
                <p className="mt-1 break-words whitespace-pre-wrap">{c.content}</p>
                {c.attachments.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-1">
                    {c.attachments.map((a) => (
                      <li key={a.id} className="flex flex-wrap items-center gap-2 text-sm">
                        <Paperclip className="size-4 text-muted-foreground" aria-hidden />
                        <span className="font-medium break-all">{a.fileName}</span>
                        <span className="text-muted-foreground">{formatFileSize(a.sizeBytes)}</span>
                        {previewKind(a.mimeType) && (
                          <Button variant="ghost" size="sm" onClick={() => setPreview(a)}>
                            <Eye aria-hidden />
                            Xem
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" asChild>
                          <a href={`/api/files/${a.id}?tai=1`} download>
                            <Download aria-hidden />
                            Tải về
                          </a>
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="h-[90dvh] max-w-[95vw] grid-rows-[auto_1fr] sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle className="truncate pr-8">{preview?.fileName}</DialogTitle>
            <DialogDescription className="sr-only">Xem trước tệp đính kèm</DialogDescription>
          </DialogHeader>
          {preview && <FilePreview file={preview} className="h-full" />}
        </DialogContent>
      </Dialog>

      {deleting && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setDeleting(null)}
          title="Xoá thảo luận?"
          description="Nội dung và tệp đính kèm của thảo luận này sẽ không còn hiển thị (vẫn lưu trong nhật ký hệ thống)."
          destructive
          confirmLabel="Xoá"
          onConfirm={() => deleteComment({ id: deleting.id })}
          successMessage="Đã xoá thảo luận."
          onSuccess={() => {
            setDeleting(null);
            router.refresh();
          }}
        />
      )}
    </section>
  );
}
