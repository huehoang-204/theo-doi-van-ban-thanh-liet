// Job 06:30 hằng ngày (Mục 5.4): bổ sung kỳ báo cáo, sinh thông báo nhắc hạn việc & báo cáo.
// Không "server-only": chạy trong worker (tsx) và integration test; luôn nhận client Prisma từ ngoài.
import type { PrismaClient } from "@/generated/prisma/client";
import { vnDateKey } from "@/lib/format";
import {
  dueReminder,
  OVERDUE_REMINDER_MAX_DAYS,
  reminderTitle,
  watcherDedupKey,
  type Reminder,
  type ReminderSubjectKind,
} from "@/lib/reminders";
import { extendOpenRequirements } from "@/server/reports/periods";

type NewNotification = {
  userId: string;
  kind: "DUE_SOON" | "OVERDUE";
  title: string;
  link: string;
  dedupKey: string;
};

export type DailyJobResult = {
  periodsCreated: number;
  taskReminders: number;
  periodReminders: number;
  notificationsCreated: number;
};

const DAY = 86_400_000;

/** Khoảng hạn cần xét hôm nay: từ (hôm nay − 7) đến (hôm nay + 3) — dạng ngày thuần */
function dueWindow(now: Date): { gte: Date; lte: Date } {
  const today = Date.parse(`${vnDateKey(now)}T00:00:00Z`);
  return { gte: new Date(today - OVERDUE_REMINDER_MAX_DAYS * DAY), lte: new Date(today + 3 * DAY) };
}

function push(
  out: NewNotification[],
  userIds: Iterable<string>,
  subject: { kind: ReminderSubjectKind; title: string; dueDate: Date; periodLabel?: string },
  reminder: Reminder,
  link: string,
  audience: "doer" | "watcher",
  dedupKey: string,
) {
  const title = reminderTitle(subject, reminder, audience);
  for (const userId of new Set(userIds))
    out.push({ userId, kind: reminder.type, title, link, dedupKey });
}

export async function runDailyJob(db: PrismaClient, now = new Date()): Promise<DailyJobResult> {
  const periodsCreated = await extendOpenRequirements(db, now);
  const window = dueWindow(now);

  const activeUsers = await db.user.findMany({
    where: { active: true },
    select: { id: true, departmentId: true },
  });
  const isActive = new Set(activeUsers.map((u) => u.id));
  const usersOfDept = new Map<string, string[]>();
  for (const u of activeUsers) {
    if (!u.departmentId) continue;
    usersOfDept.set(u.departmentId, [...(usersOfDept.get(u.departmentId) ?? []), u.id]);
  }

  const out: NewNotification[] = [];

  // ---- Công việc đang mở (chưa báo hoàn thành), văn bản gốc chưa bị xoá
  const tasks = await db.task.findMany({
    where: {
      deletedAt: null,
      flow: { in: ["NEW", "IN_PROGRESS"] },
      dueDate: window,
      OR: [{ documentId: null }, { document: { deletedAt: null } }],
    },
    select: {
      id: true,
      title: true,
      dueDate: true,
      leadUserId: true,
      leadDepartmentId: true,
      assignerId: true,
    },
  });
  let taskReminders = 0;
  for (const t of tasks) {
    const dueDate = t.dueDate!;
    const reminder = dueReminder({ kind: "task", id: t.id, dueDate }, now);
    if (!reminder) continue;
    taskReminders++;
    // Người chủ trì: cá nhân được giao, nếu chỉ giao đơn vị thì mọi tài khoản của đơn vị
    const doers =
      t.leadUserId && isActive.has(t.leadUserId)
        ? [t.leadUserId]
        : (usersOfDept.get(t.leadDepartmentId ?? "") ?? []);
    const subject = { kind: "task" as const, title: t.title, dueDate };
    const link = `/cong-viec/${t.id}`;
    push(out, doers, subject, reminder, link, "doer", reminder.dedupKey);
    if (
      reminder.type === "OVERDUE" &&
      reminder.firstDay &&
      isActive.has(t.assignerId) &&
      !doers.includes(t.assignerId)
    ) {
      push(
        out,
        [t.assignerId],
        subject,
        reminder,
        link,
        "watcher",
        watcherDedupKey("task", t.id, dueDate),
      );
    }
  }

  // ---- Kỳ báo cáo chưa nộp của yêu cầu còn hiệu lực
  const periods = await db.reportPeriod.findMany({
    where: {
      submission: null,
      dueDate: window,
      requirement: { active: true, document: { deletedAt: null } },
    },
    select: {
      id: true,
      label: true,
      dueDate: true,
      departmentId: true,
      requirement: { select: { id: true, name: true, followerUserId: true } },
    },
  });
  let periodReminders = 0;
  for (const p of periods) {
    const reminder = dueReminder({ kind: "period", id: p.id, dueDate: p.dueDate }, now);
    if (!reminder) continue;
    periodReminders++;
    const doers = usersOfDept.get(p.departmentId) ?? [];
    const subject = {
      kind: "period" as const,
      title: p.requirement.name,
      periodLabel: p.label,
      dueDate: p.dueDate,
    };
    const link = `/bao-cao?yeuCau=${p.requirement.id}`;
    push(out, doers, subject, reminder, link, "doer", reminder.dedupKey);
    const follower = p.requirement.followerUserId;
    if (
      reminder.type === "OVERDUE" &&
      reminder.firstDay &&
      follower &&
      isActive.has(follower) &&
      !doers.includes(follower)
    ) {
      push(
        out,
        [follower],
        subject,
        reminder,
        link,
        "watcher",
        watcherDedupKey("period", p.id, p.dueDate),
      );
    }
  }

  // Khoá (userId, dedupKey) duy nhất → chạy lại trong ngày không sinh trùng
  const created = out.length
    ? (await db.notification.createMany({ data: out, skipDuplicates: true })).count
    : 0;
  return { periodsCreated, taskReminders, periodReminders, notificationsCreated: created };
}
