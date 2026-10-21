import type { Metadata } from "next";

import { DashboardScreen } from "@/components/dashboard/DashboardScreen";
import { vi } from "@/lib/i18n/vi";
import { requirePermission } from "@/server/auth/current-user";
import { getDashboard } from "@/server/dashboard/data";

export const metadata: Metadata = { title: vi.nav.dashboard };

export default async function DashboardPage({ searchParams }: PageProps<"/">) {
  const user = await requirePermission("dashboard.viewReduced");
  const { namHoc } = await searchParams;
  const data = await getDashboard(user, typeof namHoc === "string" ? namHoc : null);
  return <DashboardScreen initial={data} wardName={data.ward?.name ?? vi.app.wardName} />;
}
