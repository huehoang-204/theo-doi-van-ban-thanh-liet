import type { Metadata } from "next";

import { SchoolsTable } from "@/components/catalog/SchoolsTable";
import { PageHeader } from "@/components/common/PageHeader";
import { vi } from "@/lib/i18n/vi";
import { can } from "@/lib/permissions";
import { requirePermission } from "@/server/auth/current-user";
import {
  getCurrentSchoolYear,
  listAllSchoolStats,
  listSchools,
  listSchoolYears,
  normalizeSchoolYear,
} from "@/server/queries/catalog";

export const metadata: Metadata = { title: vi.nav.schools };

export default async function SchoolsPage({ searchParams }: PageProps<"/dia-ban/truong-hoc">) {
  const user = await requirePermission("school.view");
  const { namHoc, capHoc } = await searchParams;
  const schoolYear = normalizeSchoolYear(
    typeof namHoc === "string" ? namHoc : undefined,
    await getCurrentSchoolYear(),
  );
  const [schools, stats, years] = await Promise.all([
    listSchools(schoolYear),
    listAllSchoolStats(),
    listSchoolYears(),
  ]);

  const pick = <
    T extends {
      updatedById?: unknown;
      updatedAt?: unknown;
      createdAt?: unknown;
      isSample?: unknown;
    },
  >(
    o: T,
  ) => {
    const { updatedById: _a, updatedAt: _b, createdAt: _c, isSample: _d, ...rest } = o;
    return rest;
  };

  return (
    <>
      <PageHeader
        title={vi.nav.schools}
        description={`Danh sách trường trên địa bàn và quy mô năm học ${schoolYear}.`}
      />
      <SchoolsTable
        initialLevel={typeof capHoc === "string" ? capHoc : undefined}
        rows={schools.map((s) => ({ ...pick(s), stat: s.stat ? pick(s.stat) : null }))}
        stats={stats.map(pick)}
        schoolYear={schoolYear}
        schoolYears={years.includes(schoolYear) ? years : [schoolYear, ...years]}
        canManage={can(user, "school.manage")}
      />
    </>
  );
}
