"use client";

import { FolderTree, List, Plus, Send } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { useTree } from "./TreeContext";

/** Chuyển "Dạng cây / Dạng danh sách / Mới ban hành" + nút chính "+ Chương trình" (Mục 4.5, GĐ5b) */
export function DocumentsHeaderActions({ unread = 0 }: { unread?: number }) {
  const pathname = usePathname();
  const tree = useTree();
  const isList = pathname.startsWith("/van-ban/danh-sach");
  const isPublished = pathname.startsWith("/van-ban/ban-hanh");
  const isTree = !isList && !isPublished;
  const tab = (active: boolean) =>
    cn(
      "inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-2 py-1 text-center leading-tight font-medium sm:px-3 sm:whitespace-nowrap",
      active ? "bg-card text-brand shadow-sm" : "text-muted-foreground hover:text-foreground",
    );
  return (
    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
      <nav
        aria-label="Cách xem"
        className="grid w-full grid-cols-3 rounded-lg bg-muted p-1 sm:inline-flex sm:w-auto"
      >
        <Link href="/van-ban" className={tab(isTree)} aria-current={isTree ? "page" : undefined}>
          <FolderTree className="hidden size-5 sm:block" aria-hidden />
          Dạng cây
        </Link>
        <Link
          href="/van-ban/danh-sach"
          className={tab(isList)}
          aria-current={isList ? "page" : undefined}
        >
          <List className="hidden size-5 sm:block" aria-hidden />
          Dạng danh sách
        </Link>
        <Link
          href="/van-ban/ban-hanh"
          className={tab(isPublished)}
          aria-current={isPublished ? "page" : undefined}
        >
          <Send className="hidden size-5 sm:block" aria-hidden />
          Mới ban hành
          {unread > 0 && (
            <span
              className="rounded-full bg-accent-red px-2 text-sm leading-6 text-white tabular-nums"
              aria-label={`${unread} văn bản gửi đến chưa xem`}
            >
              {unread}
            </span>
          )}
        </Link>
      </nav>
      {tree.permissions.canCreateProgram && (
        <Button size="lg" onClick={() => tree.openCreate(null)}>
          <Plus aria-hidden />
          Chương trình
        </Button>
      )}
    </div>
  );
}
