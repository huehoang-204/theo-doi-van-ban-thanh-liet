import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { daysUntil } from "@/lib/format";
import type { TaskResource } from "@/lib/permissions";
import { taskDueStatus, type DueStatus } from "@/lib/status";
import type { CurrentUser } from "@/server/auth/current-user";
import { getSetting } from "@/server/queries/catalog";

const SEE_ALL: readonly string[] = ["ADMIN", "LEADER", "CLERK"];

export async function getDueSoonDays(): Promise<number> {
  return getSetting("dueSoonDays", 3);
}

/** Công việc người dùng được thấy: null = tất cả (ADMIN, LEADER, CLERK) */
export function taskScopeWhere(user: CurrentUser): Prisma.TaskWhereInput | null {
  if (user.roles.some((r) => SEE_ALL.includes(r))) return null;
  const or: Prisma.TaskWhereInput[] = [
    { assignerId: user.id },
    { leadUserId: user.id },
    { coUserIds: { has: user.id } },
  ];
  if (user.roles.includes("OFFICER") && user.departmentId) {
    or.push(
      { leadDepartmentId: user.departmentId },
      { coDepartmentIds: { has: user.departmentId } },
    );
  }
  return { OR: or };
}

/** Việc "của tôi / đơn vị tôi" phải làm (Mục 5.3) */
export function myTasksWhere(user: CurrentUser): Prisma.TaskWhereInput {
  const or: Prisma.TaskWhereInput[] = [{ leadUserId: user.id }, { coUserIds: { has: user.id } }];
  if (user.departmentId)
    or.push(
      { leadDepartmentId: user.departmentId },
      { coDepartmentIds: { has: user.departmentId } },
    );
  return { OR: or };
}

export function taskResourceOf(t: {
  assignerId: string;
  leadUserId: string | null;
  leadDepartmentId: string | null;
  coUserIds: string[];
  coDepartmentIds: string[];
}): TaskResource {
  return {
    assignerId: t.assignerId,
    leadUserId: t.leadUserId,
    leadDepartmentId: t.leadDepartmentId,
    coUserIds: t.coUserIds,
    coDepartmentIds: t.coDepartmentIds,
  };
}

const LIST_INCLUDE = {
  document: { select: { id: true, number: true, title: true } },
  assigner: { select: { fullName: true } },
  leadUser: { select: { fullName: true } },
  leadDepartment: { select: { id: true, name: true } },
  extensions: { where: { status: "PENDING" as const }, select: { id: true } },
} satisfies Prisma.TaskInclude;

type ListRow = Prisma.TaskGetPayload<{ include: typeof LIST_INCLUDE }>;

export type TaskListItem = {
  id: string;
  title: string;
  document: { id: string; number: string | null; title: string } | null;
  assigner: string;
  lead: string;
  leadDepartmentId: string | null;
  dueDate: Date | null;
  daysLeft: number | null;
  priority: ListRow["priority"];
  flow: ListRow["flow"];
  progress: number;
  status: DueStatus | null;
  pendingExtension: boolean;
};

function toItem(t: ListRow, now: Date, dueSoonDays: number): TaskListItem {
  return {
    id: t.id,
    title: t.title,
    document: t.document,
    assigner: t.assigner.fullName,
    lead: [t.leadUser?.fullName, t.leadDepartment?.name].filter(Boolean).join(" · ") || "—",
    leadDepartmentId: t.leadDepartmentId,
    dueDate: t.dueDate,
    daysLeft: t.dueDate ? daysUntil(t.dueDate, now) : null,
    priority: t.priority,
    flow: t.flow,
    progress: t.progress,
    status: taskDueStatus(t, now, dueSoonDays),
    pendingExtension: t.extensions.length > 0,
  };
}

export async function listTasks(
  user: CurrentUser,
  where: Prisma.TaskWhereInput = {},
): Promise<TaskListItem[]> {
  const scope = taskScopeWhere(user);
  const [rows, dueSoonDays] = await Promise.all([
    db.task.findMany({
      where: { deletedAt: null, ...where, ...(scope ? { AND: [scope] } : {}) },
      include: LIST_INCLUDE,
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
      take: 5000,
    }),
    getDueSoonDays(),
  ]);
  const now = new Date();
  return rows.map((t) => toItem(t, now, dueSoonDays));
}

const DETAIL_INCLUDE = {
  document: { select: { id: true, number: true, title: true, path: true, deletedAt: true } },
  assigner: { select: { id: true, fullName: true } },
  leadUser: { select: { id: true, fullName: true } },
  leadDepartment: { select: { id: true, name: true } },
  updates: {
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { fullName: true } },
      attachments: {
        where: { deletedAt: null },
        select: { id: true, fileName: true, mimeType: true, sizeBytes: true },
      },
    },
  },
  extensions: {
    orderBy: { createdAt: "desc" },
    include: {
      requestedBy: { select: { fullName: true } },
      decidedBy: { select: { fullName: true } },
    },
  },
} satisfies Prisma.TaskInclude;

export type TaskDetail = Prisma.TaskGetPayload<{ include: typeof DETAIL_INCLUDE }>;

export async function getTaskDetail(user: CurrentUser, id: string) {
  const scope = taskScopeWhere(user);
  const task = await db.task.findFirst({
    where: { id, deletedAt: null, ...(scope ? { AND: [scope] } : {}) },
    include: DETAIL_INCLUDE,
  });
  if (!task) return null;
  const [coDepartments, coUsers, dueSoonDays] = await Promise.all([
    db.department.findMany({ where: { id: { in: task.coDepartmentIds } }, select: { name: true } }),
    db.user.findMany({ where: { id: { in: task.coUserIds } }, select: { fullName: true } }),
    getDueSoonDays(),
  ]);
  return {
    task,
    coDepartments: coDepartments.map((d) => d.name),
    coUsers: coUsers.map((u) => u.fullName),
    status: taskDueStatus(task, new Date(), dueSoonDays),
    resource: taskResourceOf(task),
  };
}

/** Danh sách người dùng cho ô chọn (người chủ trì / phối hợp / theo dõi) */
export async function userOptions() {
  const users = await db.user.findMany({
    where: { active: true },
    orderBy: [{ department: { sortOrder: "asc" } }, { fullName: "asc" }],
    select: {
      id: true,
      fullName: true,
      position: true,
      departmentId: true,
      department: { select: { name: true } },
    },
  });
  return users.map((u) => ({
    value: u.id,
    label: `${u.fullName}${u.department ? ` — ${u.department.name}` : ""}`,
    departmentId: u.departmentId,
  }));
}
