"use client";

import {
  ClipboardList,
  CornerDownLeft,
  FileText,
  Flag,
  Loader2,
  School,
  Search,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useId, useMemo, useRef, useState } from "react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { vi } from "@/lib/i18n/vi";
import { MIN_QUERY_LENGTH } from "@/lib/search";
import { highlightParts } from "@/lib/text";
import { cn } from "@/lib/utils";
import type { GlobalSearchItem, GlobalSearchResult, SearchGroupKey } from "@/server/search/global";

const GROUP_ICONS: Record<SearchGroupKey, LucideIcon> = {
  documents: FileText,
  tasks: ClipboardList,
  schools: School,
  residentials: Warehouse,
  partyOrgs: Flag,
};

function Highlight({ text, terms }: { text: string; terms: string[] }) {
  return (
    <>
      {highlightParts(text, terms).map((p, i) =>
        p.hit ? (
          <mark
            key={i}
            className="rounded-sm bg-yellow-200 px-0.5 text-foreground dark:bg-yellow-500/40"
          >
            {p.text}
          </mark>
        ) : (
          <Fragment key={i}>{p.text}</Fragment>
        ),
      )}
    </>
  );
}

/**
 * Tìm kiếm toàn cục ở header (Mục 8.2.13): Ctrl+K (⌘K trên Mac) mở hộp tìm; gõ không dấu;
 * ↑/↓ chọn, Enter mở, Esc đóng. Kết quả nhóm theo Văn bản / Công việc / Trường / TDP / Tổ chức đảng.
 */
export function GlobalSearch() {
  const router = useRouter();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<GlobalSearchResult | null>(null);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Phím tắt toàn trang
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Gõ xong 250ms mới gọi máy chủ; huỷ yêu cầu cũ
  const q = query.trim();
  const searchable = q.length >= MIN_QUERY_LENGTH;
  useEffect(() => {
    if (!searchable) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((res) => (res.ok ? (res.json() as Promise<GlobalSearchResult>) : null))
        .then((r) => {
          setResult(r ?? { q, terms: [], groups: [] });
          setActive(0);
        })
        .catch(() => undefined); // bị huỷ hoặc mất mạng
    }, 250);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q, searchable]);
  // Đang chờ kết quả của đúng từ khoá hiện tại
  const loading = searchable && result?.q !== q;

  const flat = useMemo(
    () =>
      (searchable && result ? result.groups : []).flatMap((g) =>
        g.items.map((item) => ({ group: g.key, item })),
      ),
    [result, searchable],
  );

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function go(item: GlobalSearchItem) {
    setOpen(false);
    router.push(item.href as never);
  }

  function onInputKey(e: React.KeyboardEvent) {
    if (flat.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % flat.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + flat.length) % flat.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = flat[active];
      if (hit) go(hit.item);
    }
  }

  let index = -1;

  return (
    <>
      {/* ≥ 1024px: ô tìm rộng; nhỏ hơn: nút biểu tượng */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden h-10 w-64 items-center gap-2 rounded-lg bg-white/10 px-3 text-left text-base text-white/85 transition hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none lg:flex"
        aria-label={`${vi.layout.search} (${vi.layout.searchShortcut})`}
      >
        <Search className="size-5" aria-hidden />
        <span className="flex-1">{vi.layout.search}</span>
        <kbd className="rounded border border-white/30 px-1.5 text-xs">
          {vi.layout.searchShortcut}
        </kbd>
      </button>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex size-11 items-center justify-center rounded-lg text-white transition hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none lg:hidden"
        aria-label={vi.layout.search}
        title={vi.layout.search}
      >
        <Search className="size-5" aria-hidden />
      </button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setQuery("");
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="top-[12vh] max-w-[calc(100%-1.5rem)] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-2xl"
        >
          <DialogTitle className="sr-only">Tìm kiếm toàn hệ thống</DialogTitle>
          <DialogDescription className="sr-only">
            Tìm văn bản, công việc, trường học, tổ dân phố, tổ chức đảng. Gõ không dấu được.
          </DialogDescription>
          <div className="flex items-center gap-3 border-b px-4">
            {loading ? (
              <Loader2 className="size-5 shrink-0 animate-spin text-muted-foreground" aria-hidden />
            ) : (
              <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            )}
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onInputKey}
              placeholder="Tìm văn bản, công việc, trường, TDP, chi bộ…"
              className="h-14 min-w-0 flex-1 bg-transparent text-lg outline-none placeholder:text-muted-foreground"
              role="combobox"
              aria-label="Từ khoá tìm kiếm"
              aria-expanded={flat.length > 0}
              aria-controls={listId}
              aria-activedescendant={flat.length > 0 ? `${listId}-${active}` : undefined}
              aria-autocomplete="list"
            />
            <kbd className="hidden rounded border px-1.5 text-xs text-muted-foreground sm:inline">
              Esc
            </kbd>
          </div>

          <div ref={listRef} className="max-h-[min(60vh,32rem)] overflow-y-auto">
            {!searchable ? (
              <p className="px-4 py-8 text-center text-muted-foreground">
                Gõ ít nhất {MIN_QUERY_LENGTH} ký tự. Tìm không dấu được, VD: “quyet dinh”, “thanh
                liet”.
              </p>
            ) : result && result.q === q && flat.length === 0 && !loading ? (
              <p className="px-4 py-8 text-center text-muted-foreground" role="status">
                Không tìm thấy kết quả cho “{q}”.
              </p>
            ) : (
              <div id={listId} role="listbox" aria-label="Kết quả tìm kiếm">
                {(searchable && result ? result.groups : []).map((g) => {
                  const Icon = GROUP_ICONS[g.key];
                  return (
                    <div
                      key={g.key}
                      role="group"
                      aria-labelledby={`${listId}-${g.key}`}
                      className="py-1"
                    >
                      <div
                        id={`${listId}-${g.key}`}
                        className="px-4 pt-2 pb-1 text-sm font-semibold tracking-wide text-muted-foreground uppercase"
                      >
                        {g.label}
                      </div>
                      {g.items.map((item) => {
                        index++;
                        const i = index;
                        return (
                          <div
                            key={item.id}
                            id={`${listId}-${i}`}
                            data-index={i}
                            role="option"
                            aria-selected={i === active}
                            onMouseMove={() => setActive(i)}
                            onClick={() => go(item)}
                            className={cn(
                              "mx-2 flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2",
                              i === active && "bg-brand-soft",
                            )}
                          >
                            <Icon className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
                            <span className="min-w-0 flex-1">
                              <span className="line-clamp-2 font-medium">
                                <Highlight text={item.title} terms={result!.terms} />
                              </span>
                              {item.subtitle && (
                                <span className="block truncate text-sm text-muted-foreground">
                                  {item.subtitle}
                                </span>
                              )}
                            </span>
                            {i === active && (
                              <CornerDownLeft
                                className="mt-1 size-4 shrink-0 text-muted-foreground"
                                aria-hidden
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="hidden items-center gap-4 border-t bg-muted/50 px-4 py-2 text-sm text-muted-foreground sm:flex">
            <span>
              <kbd className="rounded border bg-card px-1">↑</kbd>{" "}
              <kbd className="rounded border bg-card px-1">↓</kbd> chọn
            </span>
            <span>
              <kbd className="rounded border bg-card px-1">Enter</kbd> mở
            </span>
            <span>
              <kbd className="rounded border bg-card px-1">Esc</kbd> đóng
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
