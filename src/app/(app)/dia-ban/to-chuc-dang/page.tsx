import type { Metadata } from "next";

import { PartyOrgsTable } from "@/components/catalog/PartyOrgsTable";
import { PageHeader } from "@/components/common/PageHeader";
import { formatNumber } from "@/lib/format";
import { PARTY_BLOCK_LABELS } from "@/lib/i18n/enums";
import { vi } from "@/lib/i18n/vi";
import { can } from "@/lib/permissions";
import { requirePermission } from "@/server/auth/current-user";
import { catalogOptions, getWardOverview, listPartyOrgsTree } from "@/server/queries/catalog";

export const metadata: Metadata = { title: vi.nav.partyOrgs };

function StatCard({
  label,
  counted,
  override,
}: {
  label: string;
  counted: number;
  override: number | null | undefined;
}) {
  const usingOverride = override !== null && override !== undefined;
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-1 text-stat font-bold text-brand tabular-nums">
        {formatNumber(usingOverride ? override : counted)}
      </p>
      <p className="mt-1 text-muted-foreground">
        {usingOverride
          ? `Số nhập tay · danh mục hiện đếm được ${formatNumber(counted)}`
          : "Đếm từ danh mục"}
      </p>
    </div>
  );
}

export default async function PartyOrgsPage({ searchParams }: PageProps<"/dia-ban/to-chuc-dang">) {
  const user = await requirePermission("partyOrg.view");
  const params = await searchParams;
  const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  const [orgs, overview, options] = await Promise.all([
    listPartyOrgsTree(),
    getWardOverview(),
    catalogOptions(),
  ]);
  const { partyStats, profile } = overview;
  const blocks = Object.entries(partyStats.cellsByBlock).sort((a, b) => b[1] - a[1]);

  return (
    <>
      <PageHeader
        title={vi.nav.partyOrgs}
        description="Đảng bộ phường, các tổ chức cơ sở đảng và chi bộ trực thuộc."
      />

      <section
        aria-label="Số liệu tổ chức đảng"
        className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3"
      >
        <StatCard
          label="Tổ chức đảng trực thuộc"
          counted={partyStats.orgCount}
          override={profile?.partyOrgCountOverride}
        />
        <StatCard
          label="Chi bộ"
          counted={partyStats.cellCount}
          override={profile?.partyCellCountOverride}
        />
        <StatCard
          label="Đảng viên"
          counted={partyStats.memberCount}
          override={profile?.partyMemberCountOverride}
        />
      </section>
      {blocks.length > 0 && (
        <p className="mb-5 text-muted-foreground">
          Chi bộ theo khối:{" "}
          {blocks
            .map(
              ([b, n]) =>
                `${PARTY_BLOCK_LABELS[b as keyof typeof PARTY_BLOCK_LABELS]} ${formatNumber(n)}`,
            )
            .join(" · ")}
        </p>
      )}

      <PartyOrgsTable
        initial={{ type: str(params.loai), block: str(params.khoi) }}
        rows={orgs.map((o) => ({
          id: o.id,
          depth: o.treeDepth,
          name: o.name,
          type: o.type,
          block: o.block,
          parentId: o.parentId,
          secretary: o.secretary,
          secretaryPhone: o.secretaryPhone,
          deputySecretary: o.deputySecretary,
          memberCount: o.memberCount,
          officialMembers: o.officialMembers,
          probationaryMembers: o.probationaryMembers,
          latestRating: o.latestRating,
          ratingYear: o.ratingYear,
          residentialId: o.residentialId,
          schoolId: o.schoolId,
          sortOrder: o.sortOrder,
          active: o.active,
          childCount: o._count.children,
        }))}
        canManage={can(user, "partyOrg.manage")}
        canOverride={can(user, "partyStats.override")}
        overrides={{
          partyOrgCountOverride: profile?.partyOrgCountOverride ?? null,
          partyCellCountOverride: profile?.partyCellCountOverride ?? null,
          partyMemberCountOverride: profile?.partyMemberCountOverride ?? null,
        }}
        parents={options.partyParents}
        residentials={options.residentials}
        schools={options.schools}
      />
    </>
  );
}
