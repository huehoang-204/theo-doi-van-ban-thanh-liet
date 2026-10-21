import {
  AlarmClock,
  BadgeCheck,
  Bell,
  CalendarClock,
  CircleAlert,
  ClipboardCheck,
  ClipboardList,
  FilePlus2,
  FileText,
  Undo2,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

// Biểu tượng theo loại thông báo; màu chỉ dùng cho nhắc hạn (vàng) và quá hạn (đỏ) — đúng màu trạng thái Mục 3.3
const ICONS: Record<string, { icon: LucideIcon; className: string }> = {
  DUE_SOON: { icon: AlarmClock, className: "text-status-due-soon" },
  OVERDUE: { icon: CircleAlert, className: "text-status-overdue" },
  TASK_ASSIGNED: { icon: ClipboardList, className: "text-brand" },
  TASK_SUBMITTED: { icon: ClipboardCheck, className: "text-brand" },
  TASK_APPROVED: { icon: BadgeCheck, className: "text-status-done" },
  TASK_RETURNED: { icon: Undo2, className: "text-brand" },
  TASK_CANCELLED: { icon: XCircle, className: "text-muted-foreground" },
  EXTENSION_REQUEST: { icon: CalendarClock, className: "text-brand" },
  EXTENSION_DECIDED: { icon: CalendarClock, className: "text-brand" },
  REPORT_REQUIRED: { icon: FileText, className: "text-brand" },
  REPORT_SUBMITTED: { icon: FileText, className: "text-brand" },
  NEW_DOCUMENT: { icon: FilePlus2, className: "text-brand" },
};

export function NotificationIcon({ kind, className }: { kind: string; className?: string }) {
  const { icon: Icon, className: color } = ICONS[kind] ?? { icon: Bell, className: "text-brand" };
  return <Icon className={cn("size-5 shrink-0", color, className)} aria-hidden />;
}
