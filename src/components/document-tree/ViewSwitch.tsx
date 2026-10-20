"use client";

import { FolderTree, List, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { useTree } from "./TreeContext";

/** Chuyển "Dạng cây / Dạng danh sách" + nút chính "+ Chương trình" (Mục 4.5) */
export function DocumentsHeaderActions() {
  const pathname = usePathname();
  const tree = useTree();
  const isList = pathname.startsWith("/van-ban/danh-sach");
  const tab = (active: boolean) =>
    cn(
      "inline-flex h-10 items-center gap-2 rounded-md px-3 font-medium",
      active ? "bg-card text-brand shadow-sm" : "text-muted-foreground hover:text-foreground",
    );
  return (
    <div className="flex flex-wrap items-center gap-2">
      <nav aria-label="Cách xem" className="inline-flex rounded-lg bg-muted p-1">
        <Link href="/van-ban" className={tab(!isList)} aria-current={!isList ? "page" : undefined}>
          <FolderTree className="size-5" aria-hidden />
          Dạng cây
        </Link>
        <Link
          href="/van-ban/danh-sach"
          className={tab(isList)}
          aria-current={isList ? "page" : undefined}
        >
          <List className="size-5" aria-hidden />
          Dạng danh sách
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
