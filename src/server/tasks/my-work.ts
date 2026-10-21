import "server-only";

import { can } from "@/lib/permissions";
import { STATUS_RANK } from "@/lib/status";
import type { CurrentUser } from "@/server/auth/current-user";
import { listPeriods } from "@/server/reports/queries";
import { db } from "@/lib/db";
import { listTasks, myTasksWhere, taskResourceOf } from "@/server/tasks/queries";

/** Kỳ báo cáo hiện trong "Việc của tôi": quá hạn + hạn trong 45 ngày tới */
const REPORT_HORIZON_DAYS = 45;

/** Dữ liệu trang "Việc của tôi" (Mục 5.3): việc & kỳ báo cáo của mình/đơn vị mình, việc chờ mình duyệt */
export async function myWork(user: CurrentUser) {
  const [tasks, periods, toApprove] = await Promise.all([
    listTasks(user, { ...myTasksWhere(user), flow: { in: ["NEW", "IN_PROGRESS", "SUBMITTED"] } }),
    user.departmentId
      ? listPeriods(user, { departmentId: user.departmentId, submission: null })
      : Promise.resolve([]),
    listTasks(user, {
      assignerId: user.id,
      OR: [{ flow: "SUBMITTED" }, { extensions: { some: { status: "PENDING" } } }],
    }),
  ]);
  // Quyền cập nhật tiến độ theo từng việc (nút thao tác nhanh)
  const raw = await db.task.findMany({
    where: { id: { in: tasks.map((t) => t.id) } },
    select: {
      id: true,
      assignerId: true,
      leadUserId: true,
      leadDepartmentId: true,
      coUserIds: true,
      coDepartmentIds: true,
    },
  });
  const updatable = new Set(
    raw.filter((t) => can(user, "task.updateProgress", taskResourceOf(t))).map((t) => t.id),
  );

  const items = [
    ...tasks.map((t) => ({ kind: "task" as const, ...t, canAct: updatable.has(t.id) })),
    ...periods
      .filter((p) => p.daysLeft <= REPORT_HORIZON_DAYS)
      .map((p) => ({ kind: "report" as const, ...p, canAct: p.canSubmit })),
  ].sort((a, b) => {
    const ra = a.status ? STATUS_RANK[a.status] : 9;
    const rb = b.status ? STATUS_RANK[b.status] : 9;
    const da = a.dueDate?.getTime() ?? Infinity;
    const dbb = b.dueDate?.getTime() ?? Infinity;
    return ra - rb || da - dbb;
  });
  return { items, toApprove };
}
