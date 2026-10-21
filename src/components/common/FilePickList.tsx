"use client";

import { FileUp, X } from "lucide-react";
import { useId } from "react";

import { SecretWarning } from "@/components/document-tree/SecretWarning";
import { Button } from "@/components/ui/button";
import { ACCEPT_ATTRIBUTE, formatFileSize } from "@/lib/file-type";

/** Chọn nhiều tệp (tải lên sau khi lưu) — luôn kèm cảnh báo văn bản mật (Mục 13.3) */
export function FilePickList({
  files,
  onChange,
  label = "Chọn tệp…",
}: {
  files: File[];
  onChange: (files: File[]) => void;
  label?: string;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <SecretWarning />
      <label
        htmlFor={id}
        className="flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-input bg-card px-4 py-2 font-medium hover:bg-brand-soft"
      >
        <FileUp className="size-5" aria-hidden />
        {label}
      </label>
      <input
        id={id}
        type="file"
        multiple
        accept={ACCEPT_ATTRIBUTE}
        className="sr-only"
        onChange={(e) => {
          onChange([...files, ...Array.from(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />
      {files.length > 0 && (
        <ul className="flex flex-col gap-1">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="flex items-center gap-2 rounded-md bg-muted px-3 py-1.5"
            >
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="text-sm text-muted-foreground">{formatFileSize(f.size)}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                aria-label={`Bỏ tệp ${f.name}`}
              >
                <X aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
