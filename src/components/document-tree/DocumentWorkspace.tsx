"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { DeleteDialog } from "./DeleteDialog";
import { DocumentFormDialog } from "./DocumentFormDialog";
import { MoveDialog } from "./MoveDialog";
import { TreePanel } from "./TreePanel";
import { useTree } from "./TreeContext";

/**
 * Bố cục trang Văn bản (người dùng chốt 21/10/2026, thay bố cục 2 cột Mục 4.5):
 *  - /van-ban: chỉ cây văn bản, chiếm cả chiều rộng.
 *  - /van-ban/<id>: trang chi tiết riêng, cả chiều rộng, có nút quay lại cây.
 *  - Dạng danh sách, Mới ban hành: cả chiều rộng.
 * Layout giữ TreeContext → quay lại cây vẫn còn các nhánh đang mở.
 */
export function DocumentWorkspace({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const tree = useTree();

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

  if (isDetail) {
    return (
      <>
        <Link
          href="/van-ban"
          className="mb-3 inline-flex min-h-11 items-center gap-2 font-medium text-brand hover:underline"
        >
          <ArrowLeft className="size-5" aria-hidden />
          Cây văn bản
        </Link>
        <section
          aria-label="Chi tiết văn bản"
          className="min-w-0 rounded-xl border bg-card p-4 shadow-sm md:p-6"
        >
          {children}
        </section>
        {dialogs}
      </>
    );
  }

  return (
    <>
      {children}
      <aside
        aria-label="Cây văn bản"
        className="flex min-h-[60dvh] min-w-0 flex-col overflow-hidden rounded-xl border bg-card shadow-sm md:h-[calc(100dvh-14rem)]"
      >
        <TreePanel />
      </aside>
      {dialogs}
    </>
  );
}
