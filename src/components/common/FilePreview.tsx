"use client";

import { Download, FileWarning, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { previewKind } from "@/lib/file-type";
import { cn } from "@/lib/utils";

export type PreviewFile = { id: string; fileName: string; mimeType: string };

const MAX_ROWS = 500;
const MAX_COLS = 40;

type Sheet = { name: string; rows: string[][]; truncated: boolean };

/** Chỉ giữ liên kết http(s)/mailto trong bản dựng Word — bỏ javascript:, data:… */
function sanitizeRendered(root: HTMLElement) {
  root.querySelectorAll("script, iframe, object, embed, form").forEach((el) => el.remove());
  root.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((a) => {
    const href = a.getAttribute("href") ?? "";
    if (href.startsWith("#")) return;
    if (/^(https?:|mailto:)/i.test(href)) {
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    } else a.removeAttribute("href");
  });
}

function Fallback({ file, message }: { file: PreviewFile; message: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-muted-foreground">
      <FileWarning className="size-10 opacity-60" aria-hidden />
      <p>{message}</p>
      <Button variant="outline" asChild>
        <a href={`/api/files/${file.id}?tai=1`} download>
          <Download aria-hidden />
          Tải về “{file.fileName}”
        </a>
      </Button>
    </div>
  );
}

function DocxView({ file }: { file: PreviewFile }) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();
    Promise.all([
      fetch(`/api/files/${file.id}?xem=1`, { signal: ctrl.signal }).then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.arrayBuffer();
      }),
      import("docx-preview"),
    ])
      .then(async ([data, docx]) => {
        if (cancelled || !ref.current) return;
        ref.current.innerHTML = "";
        await docx.renderAsync(data, ref.current, undefined, {
          className: "docx",
          inWrapper: true,
          ignoreLastRenderedPageBreak: true,
          experimental: false,
          useBase64URL: true,
        });
        sanitizeRendered(ref.current);
        if (!cancelled) setState("ok");
      })
      .catch(() => !cancelled && setState("error"));
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [file.id]);
  return (
    <div className="relative h-full overflow-auto bg-muted/60">
      {state === "loading" && <Loading />}
      {state === "error" && (
        <Fallback file={file} message="Không dựng được bản xem trước của tệp Word này." />
      )}
      <div ref={ref} className={cn("docx-host", state !== "ok" && "hidden")} />
    </div>
  );
}

function XlsxView({ file }: { file: PreviewFile }) {
  const [sheets, setSheets] = useState<Sheet[] | null>(null);
  const [error, setError] = useState(false);
  const [active, setActive] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();
    Promise.all([
      fetch(`/api/files/${file.id}?xem=1`, { signal: ctrl.signal }).then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.arrayBuffer();
      }),
      import("exceljs"),
    ])
      .then(async ([data, mod]) => {
        const ExcelJS = (mod as unknown as { default?: typeof mod }).default ?? mod;
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(data);
        const out: Sheet[] = wb.worksheets.map((ws) => {
          const rows: string[][] = [];
          const cols = Math.min(ws.columnCount, MAX_COLS);
          const total = ws.rowCount;
          for (let r = 1; r <= Math.min(total, MAX_ROWS); r++) {
            const row = ws.getRow(r);
            rows.push(Array.from({ length: cols }, (_, c) => row.getCell(c + 1).text ?? ""));
          }
          return { name: ws.name, rows, truncated: total > MAX_ROWS || ws.columnCount > MAX_COLS };
        });
        if (!cancelled) setSheets(out);
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [file.id]);

  if (error) return <Fallback file={file} message="Không đọc được bảng tính này để xem trước." />;
  if (!sheets) return <Loading />;
  const sheet = sheets[active];
  return (
    <div className="flex h-full flex-col">
      {sheets.length > 1 && (
        <div
          className="flex gap-1 overflow-x-auto border-b bg-muted/50 p-1"
          role="tablist"
          aria-label="Trang tính"
        >
          {sheets.map((s, i) => (
            <button
              key={s.name}
              type="button"
              role="tab"
              aria-selected={i === active}
              onClick={() => setActive(i)}
              className={cn(
                "shrink-0 rounded-md px-3 py-1 text-sm font-medium",
                i === active ? "bg-card text-brand shadow-sm" : "text-muted-foreground",
              )}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto">
        {sheet && sheet.rows.length > 0 ? (
          <table className="border-collapse text-sm">
            <tbody>
              {sheet.rows.map((row, r) => (
                <tr key={r}>
                  <th className="sticky left-0 border bg-muted px-2 text-right font-normal text-muted-foreground tabular-nums">
                    {r + 1}
                  </th>
                  {row.map((cell, c) => (
                    <td key={c} className="max-w-72 border px-2 py-1 align-top whitespace-pre-wrap">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="p-6 text-center text-muted-foreground">Trang tính trống.</p>
        )}
      </div>
      {sheet?.truncated && (
        <p className="border-t px-3 py-2 text-sm text-muted-foreground">
          Chỉ hiển thị {MAX_ROWS} dòng × {MAX_COLS} cột đầu — tải về để xem đầy đủ.
        </p>
      )}
    </div>
  );
}

function Loading() {
  return (
    <div
      className="flex h-full items-center justify-center gap-2 text-muted-foreground"
      role="status"
    >
      <Loader2 className="size-5 animate-spin" aria-hidden />
      Đang mở tệp…
    </div>
  );
}

/** Xem trước tệp đính kèm: PDF, ảnh (trình duyệt hiển thị), Word .docx, Excel .xlsx (dựng ở trình duyệt) */
export function FilePreview({ file, className }: { file: PreviewFile; className?: string }) {
  const kind = previewKind(file.mimeType);
  return (
    <div className={cn("overflow-hidden rounded-lg border bg-card", className)}>
      {kind === "pdf" ? (
        <iframe
          src={`/api/files/${file.id}`}
          title={`Xem trước ${file.fileName}`}
          className="h-full w-full"
        />
      ) : kind === "image" ? (
        <div className="flex h-full items-center justify-center bg-muted/40 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- ảnh phục vụ qua API có kiểm tra quyền */}
          <img
            src={`/api/files/${file.id}`}
            alt={file.fileName}
            className="max-h-full max-w-full object-contain"
          />
        </div>
      ) : kind === "docx" ? (
        <DocxView key={file.id} file={file} />
      ) : kind === "xlsx" ? (
        <XlsxView key={file.id} file={file} />
      ) : (
        <Fallback
          file={file}
          message="Định dạng Word/Excel đời cũ (.doc, .xls) không xem trước được trên trình duyệt."
        />
      )}
    </div>
  );
}
