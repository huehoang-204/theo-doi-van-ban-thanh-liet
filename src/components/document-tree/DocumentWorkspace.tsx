"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { DeleteDialog } from "./DeleteDialog";
import { DocumentFormDialog } from "./DocumentFormDialog";
import { MoveDialog } from "./MoveDialog";
import { TreePanel } from "./TreePanel";
import { useTree } from "./TreeContext";

const WIDTH_KEY = "van-ban:do-rong-cay";
const MIN = 22;
const MAX = 60;

/**
 * Bố cục 2 cột (Mục 4.5): cây bên trái (~35–40%, kéo giãn được), chi tiết bên phải.
 * Điện thoại: /van-ban chỉ hiện cây; /van-ban/<id> chỉ hiện chi tiết (có nút quay lại).
 * Dạng danh sách (/van-ban/danh-sach) không hiện cây.
 */
export function DocumentWorkspace({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const tree = useTree();
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(40);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(WIDTH_KEY));
      // Đọc sau khi hydrate (máy chủ không biết độ rộng đã lưu) — tránh lệch HTML giữa server/client
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved >= MIN && saved <= MAX) setWidth(saved);
    } catch {
      /* trình duyệt chặn lưu trữ */
    }
  }, []);

  function startResize(e: React.PointerEvent) {
    e.preventDefault();
    const box = container.current?.getBoundingClientRect();
    if (!box) return;
    const move = (ev: PointerEvent) =>
      setWidth(Math.min(MAX, Math.max(MIN, ((ev.clientX - box.left) / box.width) * 100)));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setWidth((w) => {
        try {
          localStorage.setItem(WIDTH_KEY, String(Math.round(w)));
        } catch {
          /* bỏ qua */
        }
        return w;
      });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function keyResize(e: React.KeyboardEvent) {
    if (e.key === "ArrowLeft") setWidth((w) => Math.max(MIN, w - 2));
    if (e.key === "ArrowRight") setWidth((w) => Math.min(MAX, w + 2));
  }

  // Dạng danh sách và "Mới ban hành" chiếm cả chiều rộng (không hiện cây)
  const isList =
    pathname.startsWith("/van-ban/danh-sach") || pathname.startsWith("/van-ban/ban-hanh");
  const isDetail = /^\/van-ban\/[^/]+$/.test(pathname) && !isList;

  const dialogs = (
    <>
      {tree.dialog?.kind === "create" && (
        <DocumentFormDialog
          mode="create"
          parent={tree.dialog.parent}
          open
          onOpenChange={(o) => !o && tree.closeDialog()}
        />
      )}
      {tree.dialog?.kind === "move" && (
        <MoveDialog node={tree.dialog.node} onClose={tree.closeDialog} />
      )}
      {tree.dialog?.kind === "delete" && (
        <DeleteDialog node={tree.dialog.node} onClose={tree.closeDialog} />
      )}
    </>
  );

  if (isList) {
    return (
      <>
        {children}
        {dialogs}
      </>
    );
  }

  return (
    <div
      ref={container}
      className="flex min-h-[70dvh] gap-0 md:h-[calc(100dvh-13rem)]"
      style={{ "--tree-width": `${width}%` } as React.CSSProperties}
    >
      <aside
        aria-label="Cây văn bản"
        className={cn(
          "min-w-0 flex-col overflow-hidden rounded-xl border bg-card shadow-sm md:flex md:w-[var(--tree-width)] md:shrink-0",
          isDetail ? "hidden" : "flex w-full",
        )}
      >
        <TreePanel />
      </aside>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Kéo để đổi độ rộng cây văn bản"
        aria-valuenow={Math.round(width)}
        aria-valuemin={MIN}
        aria-valuemax={MAX}
        tabIndex={0}
        onPointerDown={startResize}
        onKeyDown={keyResize}
        className="group hidden w-3 shrink-0 cursor-col-resize items-center justify-center md:flex"
      >
        <span className="h-12 w-1 rounded-full bg-border group-hover:bg-brand group-focus-visible:bg-brand" />
      </div>
      <section
        aria-label="Chi tiết văn bản"
        className={cn(
          "min-w-0 flex-1 overflow-y-auto rounded-xl border bg-card p-4 shadow-sm md:p-6",
          isDetail ? "block" : "hidden md:block",
        )}
      >
        {isDetail && (
          <Link
            href="/van-ban"
            className="mb-3 inline-flex min-h-11 items-center gap-2 font-medium text-brand md:hidden"
          >
            <ArrowLeft className="size-5" aria-hidden />
            Cây văn bản
          </Link>
        )}
        {children}
      </section>
      {dialogs}
    </div>
  );
}
