import { Construction } from "lucide-react";

import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { vi } from "@/lib/i18n/vi";

/** Trang khung cho các chức năng chưa triển khai (Giai đoạn 0) */
export function PlaceholderPage({ title, phase }: { title: string; phase: number }) {
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
