"use client";

import type { z } from "zod";

import { EntityForm, type FieldConfig, type FormValues } from "@/components/common/EntityForm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ActionResult } from "@/server/errors";

type EntityFormDialogProps<T> = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  fields: FieldConfig[];
  schema: z.ZodType;
  defaultValues: FormValues;
  action: (values: FormValues) => Promise<ActionResult<T>>;
  submitLabel?: string;
  successMessage?: string;
  onSuccess?: (data: T) => void;
};

export function EntityFormDialog<T>({
  open,
  onOpenChange,
  title,
  description,
  onSuccess,
  ...form
}: EntityFormDialogProps<T>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {open && (
          <EntityForm
            {...form}
            onCancel={() => onOpenChange(false)}
            onSuccess={(data: T) => {
              onOpenChange(false);
              onSuccess?.(data);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
