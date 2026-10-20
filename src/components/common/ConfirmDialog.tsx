"use client";

import { useState } from "react";
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
import type { ActionResult } from "@/server/errors";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Nói rõ hậu quả (Mục 8.2.10) */
  description: React.ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  successMessage?: string;
  onConfirm: () => Promise<ActionResult<unknown>>;
  onSuccess?: () => void;
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Xoá",
  destructive = true,
  successMessage = "Đã xoá.",
  onConfirm,
  onSuccess,
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false);

  async function confirm() {
    setPending(true);
    const result = await onConfirm();
    setPending(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success(successMessage);
    onOpenChange(false);
    onSuccess?.();
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl">{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>{description}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending} className="h-11">
            Huỷ
          </AlertDialogCancel>
          <Button
            type="button"
            size="lg"
            variant={destructive ? "destructive" : "default"}
            onClick={confirm}
            disabled={pending}
          >
            {pending ? "Đang xử lý…" : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
