"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { DocumentPicker, type PickedDocument } from "@/components/common/DocumentPicker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { canAddChild } from "@/lib/tree";
import { moveDocument } from "@/server/actions/documents";

import { useTree } from "./TreeContext";
import type { NodeRef } from "./types";

/** "Chuyển đến…" — di chuyển bằng chọn cha mới (thay cho kéo-thả, dùng được bằng bàn phím) */
export function MoveDialog({ node, onClose }: { node: NodeRef; onClose: () => void }) {
  const tree = useTree();
  const router = useRouter();
  const [target, setTarget] = useState<PickedDocument | null>(null);
  const [toRoot, setToRoot] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    setPending(true);
    setError(null);
    const result = await moveDocument({
      id: node.id,
      newParentId: toRoot ? null : (target?.id ?? null),
      index: 100_000,
    });
    setPending(false);
    if (!result.ok) return setError(result.error.message);
    toast.success(`Đã chuyển “${node.label}”.`);
    await tree.refresh([result.data.oldParentId, result.data.newParentId]);
    if (result.data.newParentId && !tree.expanded.has(result.data.newParentId))
      tree.toggle(result.data.newParentId);
    router.refresh();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Chuyển “{node.label}”</DialogTitle>
          <DialogDescription>
            Văn bản được chuyển cùng toàn bộ văn bản con/cháu và đặt cuối danh sách của nơi mới. Cây
            tối đa {tree.maxDepth} cấp.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <label className="font-medium" htmlFor="move-target">
            Chuyển vào văn bản
          </label>
          <DocumentPicker
            id="move-target"
            value={toRoot ? null : target}
            onChange={(d) => {
              setTarget(d);
              setToRoot(false);
              setError(null);
            }}
            exclude={(h) => h.path.startsWith(node.path)}
            disabledReason={(h) =>
              !canAddChild(h.depth, tree.maxDepth)
                ? `Đã ở cấp ${h.depth} (cấp cuối), không chứa văn bản con được.`
                : h.id === node.parentId
                  ? "Đang là văn bản cha hiện tại."
                  : null
            }
          />
          {node.isProgram && node.depth > 1 && (
            <label className="flex min-h-11 cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                className="size-5"
                checked={toRoot}
                onChange={(e) => setToRoot(e.target.checked)}
              />
              Đưa lên cấp 1 (thành chương trình độc lập)
            </label>
          )}
          {error && (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-destructive">
              {error}
            </p>
          )}
        </div>
        <div className="flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:justify-end">
          <Button variant="outline" size="lg" onClick={onClose} disabled={pending}>
            Huỷ
          </Button>
          <Button size="lg" onClick={submit} disabled={pending || (!target && !toRoot)}>
            {pending ? "Đang chuyển…" : "Chuyển"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
