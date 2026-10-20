import type { Metadata } from "next";

import { UsersTable } from "@/components/catalog/UsersTable";
import { PageHeader } from "@/components/common/PageHeader";
import { vi } from "@/lib/i18n/vi";
import { requirePermission } from "@/server/auth/current-user";
import { catalogOptions, listUsers } from "@/server/queries/catalog";

export const metadata: Metadata = { title: vi.nav.users };

export default async function UsersPage() {
  const me = await requirePermission("user.manage");
  const [users, options] = await Promise.all([listUsers(), catalogOptions()]);
  return (
    <>
      <PageHeader
        title={vi.nav.users}
        description="Tài khoản đăng nhập, đơn vị và vai trò (phân quyền theo Mục 12)."
      />
      <UsersTable
        rows={users.map(({ department, ...u }) => ({
          ...u,
          departmentName: department?.name ?? null,
        }))}
        departments={options.departments}
        currentUserId={me.id}
      />
    </>
  );
}
