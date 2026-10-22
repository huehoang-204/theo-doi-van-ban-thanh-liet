import type { Metadata } from "next";

import { PageHeader } from "@/components/common/PageHeader";
import { PeriodsTable } from "@/components/reports/PeriodsTable";
import { db } from "@/lib/db";
import { vi } from "@/lib/i18n/vi";
import { can } from "@/lib/permissions";
import { requirePermission } from "@/server/auth/current-user";
import { catalogOptions } from "@/server/queries/catalog";
import { listPeriods } from "@/server/reports/queries";
import { toPeriodRow } from "@/server/reports/rows";

export const metadata: Metadata = { title: vi.nav.reports };

/** Theo dõi báo cáo (QT-03). ?yeuCau=<id> lọc theo yêu cầu; ?trangThai=QUA_HAN lọc theo trạng thái */
export default async function ReportsPage({ searchParams }: PageProps<"/bao-cao">) {
  const user = await requirePermission("report.list");
  const params = await searchParams;
  const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  const [periods, options] = await Promise.all([listPeriods(user), catalogOptions()]);
  const requirementIds = [...new Set(periods.map((p) => p.requirement.id))];
  const requirements = await db.reportRequirement.findMany({
    where: { id: { in: requirementIds } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return (
    <>
      <PageHeader
        title={vi.nav.reports}
        description="Các kỳ báo cáo đơn vị phải nộp lên cấp trên — sinh tự động từ yêu cầu báo cáo trong văn bản."
      />
      <PeriodsTable
        rows={periods.map(toPeriodRow)}
        canUnlock={can(user, "report.unlock")}
        departments={options.departments}
        requirements={requirements.map((r) => ({ value: r.id, label: r.name }))}
        initial={{
          requirement: str(params.yeuCau),
          month: str(params.thang),
          status: str(params.trangThai),
          withinDays: str(params.trongNgay)
            ? Number(str(params.trongNgay)) || undefined
            : undefined,
        }}
      />
    </>
  );
}
