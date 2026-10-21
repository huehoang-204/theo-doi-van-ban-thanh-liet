import "server-only";

import { db } from "@/lib/db";
import {
  countBy,
  latest,
  overdueByDepartment,
  populationDensity,
  sortProgramsByProgress,
  sumBy,
  taskBuckets,
  upcomingReports,
  withOverride,
} from "@/lib/dashboard";
import { dateOnlyKey, formatDate, formatDateTime, formatLongDate, vnDateKey } from "@/lib/format";
import { PARTY_BLOCK_LABELS, SCHOOL_LEVEL_LABELS } from "@/lib/i18n/enums";
import { CELL_TYPES, computePartyStats } from "@/lib/party";
import { can } from "@/lib/permissions";
import type { DueStatus } from "@/lib/status";
import type { CurrentUser } from "@/server/auth/current-user";
import { documentScope, listChildren } from "@/server/documents/queries";
import {
  getCurrentSchoolYear,
  listSchoolYears,
  normalizeSchoolYear,
} from "@/server/queries/catalog";
import { listPeriods } from "@/server/reports/queries";
import { myWork } from "@/server/tasks/my-work";
import { getDueSoonDays, taskScopeWhere } from "@/server/tasks/queries";

/** Dashboard theo vai trò (Mục 7.5): đầy đủ / cán bộ (① rút gọn + Việc của tôi) / chỉ xem (① + ③④⑤) */
export type DashboardView = "full" | "officer" | "viewer";

/** Toàn bộ số liệu Bảng điều hành — chỉ kiểu JSON (ngày đã định dạng) để dùng chung cho trang và /api/dashboard */
export type DashboardData = {
  view: DashboardView;
  generatedAt: string;
  today: string;
  ward: {
    name: string;
    areaKm2: number;
    population: number;
    populationIsEstimate: boolean;
    density: number | null;
    updatedAt: string;
  } | null;
  residential: {
    count: number;
    households: number;
    population: number;
    updatedAt: string | null;
    byOldArea: { id: string; name: string; population: number; count: number }[];
    list: {
      id: string;
      name: string;
      code: number | null;
      households: number | null;
      population: number | null;
      oldArea: string | null;
    }[];
  };
  party: {
    orgs: { value: number; overridden: boolean; counted: number };
    cells: { value: number; overridden: boolean; counted: number };
    members: { value: number; overridden: boolean; counted: number };
    cellsByBlock: { block: string; label: string; count: number }[];
    topCells: { id: string; name: string; memberCount: number }[];
    updatedAt: string | null;
  };
  education: {
    schoolYear: string;
    schoolYears: string[];
    schoolCount: number;
    students: number;
    staff: number;
    classes: number;
    byLevel: { level: string; label: string; count: number }[];
    schools: {
      id: string;
      name: string;
      level: string;
      staff: number | null;
      students: number | null;
      classes: number | null;
    }[];
    updatedAt: string | null;
  };
  operations: {
    tasks: { overdue: number; dueSoon: number; inProgress: number; done: number };
    overdueByDepartment: { departmentId: string; name: string; count: number }[];
    reports: {
      id: string;
      name: string;
      label: string;
      department: string;
      dueDate: string;
      daysLeft: number;
      status: DueStatus;
      requirementId: string;
    }[];
    programs: { id: string; title: string; progress: number | null; hasOverdue: boolean }[];
    newDocuments: {
      id: string;
      number: string | null;
      title: string;
      type: string;
      color: string;
      issuedDate: string;
    }[];
  } | null;
  myWork: { overdue: number; dueSoon: number; inProgress: number; awaitingApproval: number } | null;
};

const fmt = (d: Date | null | undefined) =>
  d ? formatDate(new Date(`${vnDateKey(d)}T00:00:00Z`)) : null;

export function dashboardViewOf(user: CurrentUser): DashboardView {
  if (can(user, "dashboard.viewFull")) return "full";
  return user.roles.includes("OFFICER") ? "officer" : "viewer";
}

export async function getDashboard(
  user: CurrentUser,
  schoolYearParam?: string | null,
): Promise<DashboardData> {
  const now = new Date();
  const view = dashboardViewOf(user);
  const [currentYear, schoolYears] = await Promise.all([getCurrentSchoolYear(), listSchoolYears()]);
  const schoolYear = normalizeSchoolYear(schoolYearParam ?? undefined, currentYear);

  // ---------------------------------------------------------------- ① Địa bàn + ③④⑤ danh mục
  const [ward, residentials, oldAreas, partyOrgs, schools] = await Promise.all([
    db.wardProfile.findUnique({ where: { id: 1 } }),
    db.residential.findMany({
      where: { active: true },
      orderBy: [{ code: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        code: true,
        households: true,
        population: true,
        oldAreaId: true,
        updatedAt: true,
        oldArea: { select: { name: true } },
      },
    }),
    db.oldArea.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    db.partyOrg.findMany({
      select: {
        id: true,
        name: true,
        parentId: true,
        type: true,
        block: true,
        memberCount: true,
        active: true,
        updatedAt: true,
      },
    }),
    db.school.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { stats: { where: { schoolYear } } },
    }),
  ]);

  const area = ward ? Number(ward.areaKm2) : 0;
  const party = computePartyStats(partyOrgs);
  const partyChildren = new Set(
    partyOrgs.filter((o) => o.active && o.parentId).map((o) => o.parentId!),
  );
  const anyOverride =
    ward &&
    [ward.partyOrgCountOverride, ward.partyCellCountOverride, ward.partyMemberCountOverride].some(
      (v) => v !== null,
    );
  const stat = (s: (typeof schools)[number]) => s.stats[0] ?? null;

  const data: DashboardData = {
    view,
    generatedAt: formatDateTime(now),
    today: formatLongDate(now),
    ward: ward && {
      name: ward.name,
      areaKm2: area,
      population: ward.population,
      populationIsEstimate: ward.populationIsEstimate,
      density: populationDensity(ward.population, area),
      updatedAt: fmt(ward.updatedAt)!,
    },
    residential: {
      count: residentials.length,
      households: sumBy(residentials, (r) => r.households),
      population: sumBy(residentials, (r) => r.population),
      updatedAt: fmt(latest(residentials.map((r) => r.updatedAt))),
      byOldArea: oldAreas
        .map((a) => {
          const own = residentials.filter((r) => r.oldAreaId === a.id);
          return {
            id: a.id,
            name: a.name,
            population: sumBy(own, (r) => r.population),
            count: own.length,
          };
        })
        .filter((a) => a.count > 0),
      list: residentials.map((r) => ({
        id: r.id,
        name: r.name,
        code: r.code,
        households: r.households,
        population: r.population,
        oldArea: r.oldArea?.name ?? null,
      })),
    },
    party: {
      orgs: {
        ...withOverride(party.orgCount, ward?.partyOrgCountOverride),
        counted: party.orgCount,
      },
      cells: {
        ...withOverride(party.cellCount, ward?.partyCellCountOverride),
        counted: party.cellCount,
      },
      members: {
        ...withOverride(party.memberCount, ward?.partyMemberCountOverride),
        counted: party.memberCount,
      },
      cellsByBlock: Object.entries(party.cellsByBlock)
        .map(([block, count]) => ({
          block,
          label: PARTY_BLOCK_LABELS[block as keyof typeof PARTY_BLOCK_LABELS],
          count: count ?? 0,
        }))
        .sort((a, b) => b.count - a.count),
      topCells: partyOrgs
        .filter((o) => o.active && CELL_TYPES.includes(o.type) && !partyChildren.has(o.id))
        .sort((a, b) => b.memberCount - a.memberCount)
        .slice(0, 5)
        .map((o) => ({ id: o.id, name: o.name, memberCount: o.memberCount })),
      updatedAt: fmt(
        latest([...partyOrgs.map((o) => o.updatedAt), anyOverride ? ward?.updatedAt : null]),
      ),
    },
    education: {
      schoolYear,
      schoolYears: schoolYears.includes(schoolYear) ? schoolYears : [schoolYear, ...schoolYears],
      schoolCount: schools.length,
      students: sumBy(schools, (s) => stat(s)?.students),
      staff: sumBy(schools, (s) => stat(s)?.staffTotal),
      classes: sumBy(schools, (s) => stat(s)?.classes),
      byLevel: countBy(
        schools,
        (s) => s.level,
        Object.keys(SCHOOL_LEVEL_LABELS) as (keyof typeof SCHOOL_LEVEL_LABELS)[],
      ).map((x) => ({
        level: x.key,
        label: SCHOOL_LEVEL_LABELS[x.key],
        count: x.count,
      })),
      schools: schools.map((s) => ({
        id: s.id,
        name: s.name,
        level: SCHOOL_LEVEL_LABELS[s.level],
        staff: stat(s)?.staffTotal ?? null,
        students: stat(s)?.students ?? null,
        classes: stat(s)?.classes ?? null,
      })),
      updatedAt: fmt(
        latest([...schools.map((s) => s.updatedAt), ...schools.map((s) => stat(s)?.updatedAt)]),
      ),
    },
    operations: null,
    myWork: null,
  };

  // ---------------------------------------------------------------- ② Điều hành (vai trò xem đầy đủ)
  if (view === "full") {
    const scope = taskScopeWhere(user);
    const todayKey = vnDateKey(now);
    const in14 = new Date(Date.parse(`${todayKey}T00:00:00Z`) + 14 * 86_400_000);
    const docScope = await documentScope(user);
    const [tasks, dueSoonDays, periods, programs, docs, departments] = await Promise.all([
      db.task.findMany({
        where: { deletedAt: null, ...(scope ? { AND: [scope] } : {}) },
        select: {
          flow: true,
          dueDate: true,
          completedAt: true,
          submittedAt: true,
          leadDepartmentId: true,
        },
      }),
      getDueSoonDays(),
      listPeriods(user, { submission: null, dueDate: { lte: in14 } }),
      listChildren(user, null),
      db.documentNode.findMany({
        where: {
          deletedAt: null,
          issuedDate: { not: null },
          ...(docScope ? { id: { in: [...docScope.direct] } } : {}),
        },
        orderBy: [{ issuedDate: "desc" }, { createdAt: "desc" }],
        take: 10,
        select: {
          id: true,
          number: true,
          title: true,
          issuedDate: true,
          type: { select: { name: true, color: true } },
        },
      }),
      db.department.findMany({ select: { id: true, name: true } }),
    ]);
    const deptName = new Map(departments.map((d) => [d.id, d.name]));
    data.operations = {
      tasks: taskBuckets(tasks, now, dueSoonDays),
      overdueByDepartment: overdueByDepartment(tasks, now).map((x) => ({
        ...x,
        name: x.departmentId ? (deptName.get(x.departmentId) ?? "?") : "Chưa giao đơn vị",
      })),
      reports: upcomingReports(
        periods.map((p) => ({ ...p, submitted: !!p.submission })),
        14,
      ).map((p) => ({
        id: p.id,
        name: p.requirement.name,
        label: p.label,
        department: p.department.name,
        dueDate: formatDate(p.dueDate),
        daysLeft: p.daysLeft,
        status: p.status,
        requirementId: p.requirement.id,
      })),
      programs: sortProgramsByProgress(
        programs
          .filter((p) => !p.restricted)
          .map((p) => ({
            id: p.id,
            title: p.title,
            progress: p.progress,
            hasOverdue: p.hasOverdue,
          })),
      ),
      newDocuments: docs.map((d) => ({
        id: d.id,
        number: d.number,
        title: d.title,
        type: d.type.name,
        color: d.type.color,
        issuedDate: d.issuedDate
          ? formatDate(new Date(`${dateOnlyKey(d.issuedDate)}T00:00:00Z`))
          : "",
      })),
    };
  }

  // ---------------------------------------------------------------- Cán bộ: "Việc của tôi" thay khối ②
  if (view === "officer") {
    const { items, toApprove } = await myWork(user);
    data.myWork = {
      overdue: items.filter((i) => i.status === "QUA_HAN").length,
      dueSoon: items.filter((i) => i.status === "SAP_DEN_HAN").length,
      inProgress: items.filter((i) => i.status === "CHUA_DEN_HAN" || i.status === "KHONG_HAN")
        .length,
      awaitingApproval: toApprove.length,
    };
  }
  return data;
}
