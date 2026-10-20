import { Inbox, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: LucideIcon;
  /** Nút hành động, VD "+ Tạo chương trình đầu tiên" (Mục 8.2.12) */
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-input bg-card px-6 py-14 text-center",
        className,
      )}
    >
      <span className="mb-4 flex size-16 items-center justify-center rounded-full bg-brand-soft text-brand">
        <Icon className="size-8" aria-hidden />
      </span>
      <p className="text-lg font-semibold">{title}</p>
      {description && <p className="mt-2 max-w-md text-muted-foreground">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
