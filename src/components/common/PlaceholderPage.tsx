import { Construction } from "lucide-react";

import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { vi } from "@/lib/i18n/vi";
import type { Action } from "@/lib/permissions";
import { requirePermission } from "@/server/auth/current-user";

/** Trang khung cho các chức năng chưa triển khai — vẫn kiểm tra quyền như trang thật */
export async function PlaceholderPage({
  title,
  phase,
  permission,
}: {
  title: string;
  phase: number;
  permission: Action;
}) {
  await requirePermission(permission);
  return (
    <>
      <PageHeader title={title} />
      <EmptyState
        icon={Construction}
        title={vi.common.underConstruction}
        description={vi.common.plannedForPhase(phase)}
      />
    </>
  );
}
