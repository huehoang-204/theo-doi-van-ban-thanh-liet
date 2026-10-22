import "server-only";

import type { TaskRow } from "@/components/tasks/TasksTable";
import { vnMonthKey } from "@/lib/dashboard";
import { formatDate } from "@/lib/format";
import type { TaskListItem } from "@/server/tasks/queries";

/** Công việc → dòng bảng (dữ liệu tuần tự hoá được cho client component) */
export function toTaskRow(t: TaskListItem): TaskRow {
  return {
    id: t.id,
    title: t.title,
    document: t.document,
    assigner: t.assigner,
    lead: t.lead,
    leadDepartmentId: t.leadDepartmentId,
    dueDate: t.dueDate ? formatDate(t.dueDate) : null,
    dueSort: t.dueDate?.toISOString() ?? "9999",
    daysLeft: t.daysLeft,
    priority: t.priority,
    flow: t.flow,
    progress: t.progress,
    status: t.status,
    pendingExtension: t.pendingExtension,
    createdMonth: vnMonthKey(t.createdAt),
    completedMonth: t.flow === "DONE" && t.completedAt ? vnMonthKey(t.completedAt) : null,
  };
}
