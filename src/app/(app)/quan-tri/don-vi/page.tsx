import type { Metadata } from "next";

import { DepartmentsTable } from "@/components/catalog/DepartmentsTable";
import { PageHeader } from "@/components/common/PageHeader";
import { vi } from "@/lib/i18n/vi";
import { requirePermission } from "@/server/auth/current-user";
import { listDepartments } from "@/server/queries/catalog";

export const metadata: Metadata = { title: vi.nav.departments };

export default async function DepartmentsPage() {
  await requirePermission("department.manage");
  const departments = await listDepartments();
  return (
    <>
      <PageHeader
        title={vi.nav.departments}
        description="Các phòng, ban, đơn vị của phường — mỗi người dùng thuộc một đơn vị."
      />
      <DepartmentsTable
        rows={departments.map(({ _count, ...d }) => ({ ...d, userCount: _count.users }))}
      />
    </>
  );
}
