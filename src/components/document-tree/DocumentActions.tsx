"use client";

import { FolderInput, Pencil, Plus, Trash2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import { DocumentFormDialog, type DocumentEditValues } from "./DocumentFormDialog";
import { useTree } from "./TreeContext";
import type { NodeRef } from "./types";

type Props = {
  node: NodeRef;
  doc: DocumentEditValues;
  canEdit: boolean;
  canDelete: boolean;
  canAddChild: boolean;
};

/** Nút thao tác trên trang chi tiết văn bản */
export function DocumentActions({ node, doc, canEdit, canDelete, canAddChild }: Props) {
  const tree = useTree();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  // ?sua=1 (từ menu chuột phải "Sửa") → mở sẵn form sửa
  const [editing, setEditing] = useState(search.get("sua") === "1" && canEdit);

  return (
    <div className="flex flex-wrap gap-2">
      {canEdit && (
        <Button variant="outline" onClick={() => setEditing(true)}>
          <Pencil aria-hidden />
          Sửa
        </Button>
      )}
      {canAddChild && (
        <Button variant="outline" onClick={() => tree.openCreate(node)}>
          <Plus aria-hidden />
          Văn bản con
        </Button>
      )}
      {canEdit && (
        <Button variant="outline" onClick={() => tree.openMove(node)}>
          <FolderInput aria-hidden />
          Chuyển đến…
        </Button>
      )}
      {canDelete && (
        <Button
          variant="outline"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => tree.openDelete(node)}
        >
          <Trash2 aria-hidden />
          Xoá
        </Button>
      )}
      {editing && (
        <DocumentFormDialog
          mode="edit"
          doc={doc}
          open
          onOpenChange={(o) => {
            if (o) return;
            setEditing(false);
            if (search.get("sua")) router.replace(pathname as never);
          }}
        />
      )}
    </div>
  );
}
