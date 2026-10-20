import "server-only";

import { db } from "@/lib/db";
import { computePartyStats, flattenTree } from "@/lib/party";
import { schoolYearRegex } from "@/lib/schemas/catalog";

// ---------- Cấu hình ----------
export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.setting.findUnique({ where: { key } });
  return (row?.value as T | undefined) ?? fallback;
}

export async function getCurrentSchoolYear(): Promise<string> {
  return getSetting("currentSchoolYear", "2026-2027");
}

// ---------- Thông tin phường ----------
export async function getWardOverview() {
  const [profile, residentials, partyOrgs] = await Promise.all([
    db.wardProfile.findUnique({
      where: { id: 1 },
      include: { updatedBy: { select: { fullName: true } } },
    }),
    db.residential.aggregate({
      where: { active: true },
      _sum: { population: true, households: true },
      _count: true,
    }),
    db.partyOrg.findMany({
      select: {
        id: true,
        parentId: true,
        type: true,
        block: true,
        memberCount: true,
        active: true,
      },
    }),
  ]);
  return {
    profile: profile ? { ...profile, areaKm2: Number(profile.areaKm2) } : null,
    residentialCount: residentials._count,
    residentialPopulation: residentials._sum.population ?? 0,
    residentialHouseholds: residentials._sum.households ?? 0,
    partyStats: computePartyStats(partyOrgs),
  };
}

// ---------- Đơn vị & người dùng ----------
export async function listDepartments() {
  return db.department.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { users: true } } },
  });
}

export async function listUsers() {
  return db.user.findMany({
    orderBy: [{ active: "desc" }, { username: "asc" }],
    select: {
      id: true,
      username: true,
      fullName: true,
      position: true,
      phone: true,
      email: true,
      roles: true,
      active: true,
      departmentId: true,
      department: { select: { name: true } },
      lockedUntil: true,
      mustChangePassword: true,
      lastLoginAt: true,
    },
  });
}

// ---------- Danh mục chung ----------
export async function listDocumentTypes() {
  return db.documentType.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { documents: true } } },
  });
}

export async function listFields() {
  return db.field.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { documents: true } } },
  });
}

export async function listIssuingAgencies() {
  return db.issuingAgency.findMany({
    orderBy: [{ level: "asc" }, { name: "asc" }],
    include: { _count: { select: { documents: true } } },
  });
}

export async function listOldAreas() {
  return db.oldArea.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { residentials: true } } },
  });
}

// ---------- Trường học ----------
export async function listSchoolYears(): Promise<string[]> {
  const [rows, current] = await Promise.all([
    db.schoolYearStat.findMany({ distinct: ["schoolYear"], select: { schoolYear: true } }),
    getCurrentSchoolYear(),
  ]);
  return [...new Set([current, ...rows.map((r) => r.schoolYear)])].sort().reverse();
}

export function normalizeSchoolYear(value: string | undefined, fallback: string): string {
  return value && schoolYearRegex.test(value) ? value : fallback;
}

export async function listSchools(schoolYear: string) {
  const schools = await db.school.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { stats: { where: { schoolYear } } },
  });
  return schools.map(({ stats, ...school }) => ({ ...school, stat: stats[0] ?? null }));
}

export async function listAllSchoolStats() {
  return db.schoolYearStat.findMany({ orderBy: [{ schoolId: "asc" }, { schoolYear: "asc" }] });
}

// ---------- Tổ dân phố ----------
export async function listResidentials() {
  return db.residential.findMany({
    orderBy: [{ code: "asc" }, { name: "asc" }],
    include: { oldArea: { select: { name: true } }, partyOrg: { select: { name: true } } },
  });
}

// ---------- Tổ chức đảng ----------
export async function listPartyOrgsTree() {
  const orgs = await db.partyOrg.findMany({
    include: {
      parent: { select: { name: true } },
      residential: { select: { name: true } },
      school: { select: { name: true } },
      _count: { select: { children: true } },
    },
  });
  return flattenTree(
    orgs,
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "vi"),
  );
}

/** Lựa chọn cho ô chọn (id + tên) */
export async function catalogOptions() {
  const [departments, oldAreas, partyOrgs, residentials, schools] = await Promise.all([
    db.department.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    db.oldArea.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    db.partyOrg.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, type: true },
    }),
    db.residential.findMany({
      where: { active: true },
      orderBy: [{ code: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    db.school.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);
  const opt = (rows: { id: string; name: string }[]) =>
    rows.map((r) => ({ value: r.id, label: r.name }));
  return {
    departments: opt(departments),
    oldAreas: opt(oldAreas),
    partyOrgs: opt(partyOrgs),
    partyParents: partyOrgs
      .filter((o) => o.type !== "CHI_BO_CO_SO" && o.type !== "CHI_BO_TRUC_THUOC")
      .map((o) => ({ value: o.id, label: o.name })),
    residentials: opt(residentials),
    schools: opt(schools),
  };
}
