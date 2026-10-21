import type { Metadata } from "next";

import { ResidentialsTable } from "@/components/catalog/ResidentialsTable";
import { PageHeader } from "@/components/common/PageHeader";
import { vi } from "@/lib/i18n/vi";
import { can } from "@/lib/permissions";
import { requirePermission } from "@/server/auth/current-user";
import { catalogOptions, listResidentials } from "@/server/queries/catalog";

export const metadata: Metadata = { title: vi.nav.residentials };

export default async function ResidentialsPage({ searchParams }: PageProps<"/dia-ban/to-dan-pho">) {
  const user = await requirePermission("residential.view");
  const { khuVuc, tim } = await searchParams;
  const [rows, options] = await Promise.all([listResidentials(), catalogOptions()]);
  return (
    <>
      <PageHeader
        title={vi.nav.residentials}
        description="Danh sách tổ dân phố, số hộ, nhân khẩu và chi bộ phụ trách."
      />
      <ResidentialsTable
        initialArea={typeof khuVuc === "string" ? khuVuc : undefined}
        initialQuery={typeof tim === "string" ? tim : undefined}
        rows={rows.map(
          ({
            oldArea,
            partyOrg,
            createdAt: _c,
            updatedAt: _u,
            updatedById: _b,
            isSample: _s,
            ...r
          }) => ({
            ...r,
            oldAreaName: oldArea?.name ?? null,
            partyOrgName: partyOrg?.name ?? null,
          }),
        )}
        canManage={can(user, "residential.manage")}
        oldAreas={options.oldAreas}
        partyOrgs={options.partyOrgs}
      />
    </>
  );
}
