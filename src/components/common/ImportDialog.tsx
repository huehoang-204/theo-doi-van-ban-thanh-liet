"use client";

import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ImportKind } from "@/lib/excel/import-specs";

type ImportResponse =
  | { ok: true; total: number; created: number; updated: number }
  | { ok: false; errors?: string[]; message?: string };

const MAX_SHOWN_ERRORS = 200;

/** Nhập Excel: tải file mẫu → chọn tệp → báo kết quả hoặc danh sách lỗi theo dòng */
export function ImportDialog({ kind, title }: { kind: ImportKind; title: string }) {
  const router = useRouter();
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  function reset(next: boolean) {
    setOpen(next);
    if (!next) {
      setFile(null);
      setErrors([]);
    }
  }

  async function upload() {
    if (!file) return;
    setPending(true);
    setErrors([]);
    try {
      const body = new FormData();
      body.set("file", file);
      const res = await fetch(`/api/import/${kind}`, { method: "POST", body });
      const data = (await res.json().catch(() => ({
        ok: false,
        errors: ["Máy chủ trả về phản hồi không hợp lệ."],
      }))) as ImportResponse;
      if (data.ok) {
        toast.success(
          `Đã nhập ${data.total} dòng: thêm mới ${data.created}, cập nhật ${data.updated}.`,
        );
        reset(false);
        router.refresh();
      } else {
        setErrors(data.errors ?? [data.message ?? "Không nhập được tệp."]);
      }
    } catch {
      setErrors(["Không kết nối được máy chủ. Vui lòng thử lại."]);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload aria-hidden />
          Nhập Excel
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Nhập {title.toLowerCase()} từ Excel</DialogTitle>
          <DialogDescription>
            Bản ghi trùng tên sẽ được cập nhật, tên mới sẽ được thêm. Nếu tệp có lỗi, hệ thống không
            nhập dòng nào và liệt kê lỗi theo từng dòng để bạn sửa.
          </DialogDescription>
        </DialogHeader>

        <ol className="flex flex-col gap-4">
          <li className="flex flex-col gap-2">
            <span className="font-medium">Bước 1. Tải file mẫu và điền dữ liệu</span>
            <Button variant="outline" asChild className="w-fit">
              <a href={`/api/import/${kind}/mau`} download>
                <Download aria-hidden />
                Tải file mẫu
              </a>
            </Button>
          </li>
          <li className="flex flex-col gap-2">
            <label htmlFor={inputId} className="font-medium">
              Bước 2. Chọn tệp Excel (.xlsx) đã điền
            </label>
            <input
              id={inputId}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setErrors([]);
              }}
              className="block w-full rounded-lg border border-input bg-card p-2 text-base file:mr-3 file:rounded-md file:border-0 file:bg-brand-soft file:px-3 file:py-2 file:font-medium file:text-brand"
            />
            {file && (
              <span className="flex items-center gap-2 text-muted-foreground">
                <FileSpreadsheet className="size-5 text-status-done" aria-hidden />
                {file.name}
              </span>
            )}
          </li>
        </ol>

        {errors.length > 0 && (
          <div
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/5 p-4"
          >
            <p className="font-semibold text-destructive">
              Tệp có {errors.length} lỗi — chưa nhập dòng nào. Vui lòng sửa rồi nhập lại:
            </p>
            <ul className="mt-2 max-h-64 list-disc overflow-y-auto pl-5 text-[0.9375rem]">
              {errors.slice(0, MAX_SHOWN_ERRORS).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
            {errors.length > MAX_SHOWN_ERRORS && (
              <p className="mt-2 text-muted-foreground">
                … và {errors.length - MAX_SHOWN_ERRORS} lỗi khác.
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:justify-end">
          <Button variant="outline" size="lg" onClick={() => reset(false)} disabled={pending}>
            Đóng
          </Button>
          <Button size="lg" onClick={upload} disabled={!file || pending}>
            {pending ? "Đang nhập…" : "Nhập dữ liệu"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
