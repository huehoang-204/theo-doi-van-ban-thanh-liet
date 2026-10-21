import {
  CheckCheck,
  CircleAlert,
  CircleCheck,
  Hourglass,
  Minus,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";

import { STATUS_STYLE, statusLabel, type DueStatus, type StatusContext } from "@/lib/status";
import { cn } from "@/lib/utils";

/** Biểu tượng trạng thái (Mục 3.3) — dùng icon thay emoji để hiển thị chắc chắn trên mọi máy */
export const STATUS_ICONS: Record<DueStatus, LucideIcon> = {
  CHUA_DEN_HAN: Hourglass,
  SAP_DEN_HAN: TriangleAlert,
  QUA_HAN: CircleAlert,
  HOAN_THANH: CircleCheck,
  HOAN_THANH_TRE: CheckCheck,
  KHONG_HAN: Minus,
};

/** Huy hiệu trạng thái theo hạn (Mục 3.3) — màu + biểu tượng + chữ (không chỉ dựa vào màu) */
export function StatusBadge({
  status,
  context = "task",
  className,
}: {
  status: DueStatus | null;
  context?: StatusContext;
  className?: string;
}) {
  if (!status) return <span className="text-muted-foreground">Đã huỷ</span>;
  const { color } = STATUS_STYLE[status];
  const Icon = STATUS_ICONS[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-sm font-semibold whitespace-nowrap",
        status === "HOAN_THANH_TRE" && "border-status-due-soon",
        className,
      )}
      style={{
        color,
        backgroundColor: `${color}14`,
        borderColor: status === "HOAN_THANH_TRE" ? undefined : `${color}40`,
      }}
      data-status={status}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {statusLabel(status, context)}
    </span>
  );
}

export function ProgressBar({ value, className }: { value: number | null; className?: string }) {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={cn("inline-flex min-w-28 items-center gap-2", className)}>
      <span
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Tiến độ ${value}%`}
        className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted"
      >
        <span className="block h-full rounded-full bg-brand" style={{ width: `${value}%` }} />
      </span>
      <span className="w-10 text-right tabular-nums">{value}%</span>
    </span>
  );
}

/** "còn 3 ngày" / "quá 2 ngày" / "đến hạn hôm nay" có tô màu theo trạng thái */
export function DueText({
  daysLeft,
  status,
}: {
  daysLeft: number | null;
  status: DueStatus | null;
}) {
  if (daysLeft === null || status === "HOAN_THANH" || status === "HOAN_THANH_TRE" || !status)
    return null;
  const text =
    daysLeft === 0
      ? "đến hạn hôm nay"
      : daysLeft > 0
        ? `còn ${daysLeft} ngày`
        : `quá ${-daysLeft} ngày`;
  return (
    <span className="text-sm font-medium" style={{ color: STATUS_STYLE[status].color }}>
      {text}
    </span>
  );
}
