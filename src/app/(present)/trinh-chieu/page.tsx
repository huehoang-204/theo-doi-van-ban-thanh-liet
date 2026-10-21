import type { Metadata } from "next";

import { PresentationScreen } from "@/components/dashboard/PresentationScreen";
import { vi } from "@/lib/i18n/vi";
import { requirePermission } from "@/server/auth/current-user";
import { getDashboard } from "@/server/dashboard/data";

export const metadata: Metadata = { title: vi.nav.presentation };

/** Chế độ trình chiếu lên TV phòng họp giao ban (Mục 7.1): không thanh bên, chữ to, tự làm mới */
export default async function PresentationPage() {
  const user = await requirePermission("dashboard.viewReduced");
  const data = await getDashboard(user);
  return <PresentationScreen initial={data} wardName={data.ward?.name ?? vi.app.wardName} />;
}
