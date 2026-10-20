"use client";

import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type PickedDocument = {
  id: string;
  label: string;
  depth: number;
  path: string;
  isProgram: boolean;
};

type Hit = {
  id: string;
  number: string | null;
  title: string;
  depth: number;
  path: string;
  trail: string;
  restricted: boolean;
  type: { name: string; isProgram: boolean };
};

type DocumentPickerProps = {
  id?: string;
  value: PickedDocument | null;
  onChange: (doc: PickedDocument | null) => void;
  placeholder?: string;
  /** Loại khỏi kết quả (VD chính văn bản đang sửa / nhánh đang chuyển) */
  exclude?: (hit: { id: string; path: string; depth: number }) => boolean;
  /** Đánh dấu kết quả không chọn được kèm lý do */
  disabledReason?: (hit: { id: string; path: string; depth: number }) => string | null;
  describedBy?: string;
};

export const documentLabel = (d: { number: string | null; title: string }) =>
  d.number ? `${d.number} – ${d.title}` : d.title;

/** Tìm & chọn một văn bản (tìm không dấu, gõ ≥ 2 ký tự) */
export function DocumentPicker({
  id,
  value,
  onChange,
  placeholder = "Gõ số ký hiệu hoặc trích yếu…",
  exclude,
  disabledReason,
  describedBy,
}: DocumentPickerProps) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/documents/search?gioiHan=15&q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        const data = (await res.json()) as { hits: Hit[] };
        setHits(data.hits.filter((h) => !h.restricted && !exclude?.(h)));
      } catch {
        /* huỷ do gõ tiếp */
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, exclude]);

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-input bg-brand-soft/50 px-3 py-2">
        <span className="min-w-0 flex-1 truncate font-medium">{value.label}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => onChange(null)}
          aria-label="Bỏ chọn văn bản"
        >
          <X aria-hidden />
        </Button>
      </div>
    );
  }

  const shown = query.trim().length >= 2 ? hits : [];
  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          id={id}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="pl-10"
          aria-describedby={describedBy}
          autoComplete="off"
        />
      </div>
      {query.trim().length >= 2 && (
        <ul
          role="listbox"
          aria-label="Kết quả tìm văn bản"
          className="max-h-64 overflow-y-auto rounded-lg border bg-card"
        >
          {loading && shown.length === 0 && (
            <li className="p-3 text-muted-foreground">Đang tìm…</li>
          )}
          {!loading && shown.length === 0 && (
            <li className="p-3 text-muted-foreground">Không tìm thấy văn bản phù hợp.</li>
          )}
          {shown.map((h) => {
            const reason = disabledReason?.(h) ?? null;
            return (
              <li key={h.id} role="option" aria-selected={false} aria-disabled={!!reason}>
                <button
                  type="button"
                  disabled={!!reason}
                  onClick={() =>
                    onChange({
                      id: h.id,
                      label: documentLabel(h),
                      depth: h.depth,
                      path: h.path,
                      isProgram: h.type.isProgram,
                    })
                  }
                  className={cn(
                    "flex w-full flex-col items-start gap-0.5 border-b px-3 py-2 text-left last:border-b-0",
                    reason ? "cursor-not-allowed opacity-60" : "hover:bg-brand-soft",
                  )}
                >
                  <span className="font-medium">
                    {h.type.name}: {documentLabel(h)}{" "}
                    <span className="text-sm text-muted-foreground">(cấp {h.depth})</span>
                  </span>
                  {h.trail && <span className="text-sm text-muted-foreground">{h.trail}</span>}
                  {reason && <span className="text-sm text-destructive">{reason}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
