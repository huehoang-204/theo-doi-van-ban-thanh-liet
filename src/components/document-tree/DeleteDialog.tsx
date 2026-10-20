"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { deleteDocument, restoreDocument } from "@/server/actions/documents";

import { useTree } from "./TreeContext";
import type { NodeRef } from "./types";

/** Xoá mềm (Mục 4.4): báo rõ hậu quả; nút còn con phải xác nhận "xoá cả nhánh"; có Hoàn tác */
export function DeleteDialog({ node, onClose }: { node: NodeRef; onClose: () => void }) {
  const tree = useTree();
  const router = useRouter();
  const pathname = usePathname();
  const [count, setCount] = useState<number | null>(null);
  const [cascade, setCascade] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void fetch(`/api/documents/tree?demNhanh=${encodeURIComponent(node.id)}`)
      .then((r) => r.json())
      .then((d: { count: number }) => setCount(d.count))
      .catch(() => setCount(0));
  }, [node.id]);

  async function confirm() {
    setPending(true);
    const result = await deleteDocument({ id: node.id, cascade });
    setPending(false);
    if (!result.ok) return void toast.error(result.error.message);
    onClose();
    await tree.refresh([node.parentId]);
    toast.success(
      result.data.count > 1
        ? `Đã chuyển ${result.data.count} văn bản vào Thùng rác.`
        : "Đã chuyển văn bản vào Thùng rác.",
      {
        duration: 8000,
        action: {
          label: "Hoàn tác",
          onClick: async () => {
            const r = await restoreDocument({ id: node.id });
            if (!r.ok) return void toast.error(r.error.message);
            toast.success("Đã khôi phục.");
            await tree.refresh([node.parentId]);
            router.refresh();
          },
        },
      },
    );
    // Đang xem văn bản vừa xoá (hoặc con cháu của nó) → về văn bản cha
    const viewing = /^\/van-ban\/([^/]+)$/.exec(pathname)?.[1];
    if (viewing && (viewing === node.id || tree.nodes[viewing]?.path.startsWith(node.path))) {
      router.push(node.parentId ? `/van-ban/${node.parentId}` : "/van-ban");
    } else router.refresh();
  }

  const hasChildren = (count ?? 0) > 0;
  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl">Xoá “{node.label}”?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="flex flex-col gap-3">
              {count === null ? (
                <p>Đang kiểm tra văn bản con…</p>
              ) : hasChildren ? (
                <p>
                  Văn bản và <strong>{count} văn bản con/cháu</strong> sẽ được chuyển vào Thùng rác
                  (giữ 30 ngày, khôi phục được).
                </p>
              ) : (
                <p>Văn bản sẽ được chuyển vào Thùng rác (giữ 30 ngày, khôi phục được).</p>
              )}
              {hasChildren && (
                <label className="flex min-h-11 cursor-pointer items-center gap-3 font-medium text-foreground">
                  <input
                    type="checkbox"
                    className="size-5"
                    checked={cascade}
                    onChange={(e) => setCascade(e.target.checked)}
                  />
                  Tôi xác nhận xoá cả nhánh
                </label>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-11" disabled={pending}>
            Huỷ
          </AlertDialogCancel>
          <Button
            variant="destructive"
            size="lg"
            onClick={confirm}
            disabled={pending || count === null || (hasChildren && !cascade)}
          >
            {pending ? "Đang xoá…" : hasChildren ? "Xoá cả nhánh" : "Xoá"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
