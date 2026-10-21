import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { daysUntil } from "@/lib/format";
import { can, type DocumentResource } from "@/lib/permissions";
import { dueStatus, type DueStatus } from "@/lib/status";
import type { CurrentUser } from "@/server/auth/current-user";
import { getDueSoonDays } from "@/server/tasks/queries";

const SEE_ALL: readonly string[] = ["ADMIN", "LEADER", "CLERK"];

/** Kỳ báo cáo người dùng được thấy: null = tất cả; OFFICER/PARTY_ADMIN: đơn vị mình hoặc mình theo dõi */
export function periodScopeWhere(user: CurrentUser): Prisma.ReportPeriodWhereInput | null {
  if (user.roles.some((r) => SEE_ALL.includes(r))) return null;
  const or: Prisma.ReportPeriodWhereInput[] = [{ requirement: { followerUserId: user.id } }];
  if (user.departmentId) or.push({ departmentId: user.departmentId });
  return { OR: or };
}

const PERIOD_INCLUDE = {
  department: { select: { id: true, name: true, shortName: true } },
  requirement: {
    select: {
      id: true,
      name: true,
      frequency: true,
      active: true,
      document: { select: { id: true, number: true, title: true, deletedAt: true } },
      recipientAgency: { select: { name: true } },
    },
  },
  submission: {
    include: {
      submittedBy: { select: { fullName: true } },
      linkedDocument: { select: { id: true, number: true, title: true } },
      attachments: {
        where: { deletedAt: null },
        select: { id: true, fileName: true, mimeType: true, sizeBytes: true },
      },
    },
  },
} satisfies Prisma.ReportPeriodInclude;

type PeriodRow = Prisma.ReportPeriodGetPayload<{ include: typeof PERIOD_INCLUDE }>;

export type PeriodItem = {
  id: string;
  label: string;
  periodStart: Date;
  periodEnd: Date;
  dueDate: Date;
  daysLeft: number;
  status: DueStatus;
  department: { id: string; name: string };
  requirement: PeriodRow["requirement"];
  submission: PeriodRow["submission"];
  canSubmit: boolean;
  /** Sửa được: trong 24 giờ sau khi nộp hoặc sau khi được mở khoá */
  editable: boolean;
};

export const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

export function isSubmissionEditable(
  s: { createdAt: Date; unlockedAt: Date | null },
  now = new Date(),
): boolean {
  const t = now.getTime();
  return (
    t - s.createdAt.getTime() < EDIT_WINDOW_MS ||
    (s.unlockedAt !== null && t - s.unlockedAt.getTime() < EDIT_WINDOW_MS)
  );
}

function toItem(p: PeriodRow, user: CurrentUser, now: Date, dueSoonDays: number): PeriodItem {
  return {
    id: p.id,
    label: p.label,
    periodStart: p.periodStart,
    periodEnd: p.periodEnd,
    dueDate: p.dueDate,
    daysLeft: daysUntil(p.dueDate, now),
    status: dueStatus({
      dueDate: p.dueDate,
      completion: p.submission ? { on: p.submission.sentDate } : null,
      now,
      dueSoonDays,
    }),
    department: { id: p.department.id, name: p.department.name },
    requirement: p.requirement,
    submission: p.submission,
    canSubmit: can(user, "report.submit", { departmentId: p.departmentId }),
    editable: !!p.submission && isSubmissionEditable(p.submission, now),
  };
}

export async function listPeriods(
  user: CurrentUser,
  where: Prisma.ReportPeriodWhereInput = {},
): Promise<PeriodItem[]> {
  const scope = periodScopeWhere(user);
  const [rows, dueSoonDays] = await Promise.all([
    db.reportPeriod.findMany({
      where: {
        ...where,
        requirement: { document: { deletedAt: null } },
        ...(scope ? { AND: [scope] } : {}),
      },
      include: PERIOD_INCLUDE,
      orderBy: [{ dueDate: "asc" }, { department: { sortOrder: "asc" } }],
      take: 10_000,
    }),
    getDueSoonDays(),
  ]);
  const now = new Date();
  return rows.map((p) => toItem(p, user, now, dueSoonDays));
}

/** Yêu cầu báo cáo của một văn bản kèm thống kê kỳ (tab "Báo cáo" trên trang văn bản) */
export async function requirementsOfDocument(user: CurrentUser, documentId: string) {
  const requirements = await db.reportRequirement.findMany({
    where: { documentId },
    orderBy: { createdAt: "asc" },
    include: {
      recipientAgency: { select: { id: true, name: true } },
      followerUser: { select: { id: true, fullName: true } },
    },
  });
  const periods = await listPeriods(user, { requirementId: { in: requirements.map((r) => r.id) } });
  const departments = await db.department.findMany({
    where: { id: { in: requirements.flatMap((r) => r.departmentIds) } },
    select: { id: true, name: true },
  });
  const deptName = new Map(departments.map((d) => [d.id, d.name]));
  return requirements.map((r) => {
    const own = periods.filter((p) => p.requirement.id === r.id);
    const count = (s: DueStatus) => own.filter((p) => p.status === s).length;
    return {
      ...r,
      departmentNames: r.departmentIds.map((id) => deptName.get(id) ?? "?"),
      stats: {
        total: own.length,
        submitted: count("HOAN_THANH") + count("HOAN_THANH_TRE"),
        late: count("HOAN_THANH_TRE"),
        overdue: count("QUA_HAN"),
        dueSoon: count("SAP_DEN_HAN"),
      },
      upcoming: own.filter((p) => !p.submission).slice(0, 6),
    };
  });
}

export type DocumentRef = DocumentResource & { id: string };
