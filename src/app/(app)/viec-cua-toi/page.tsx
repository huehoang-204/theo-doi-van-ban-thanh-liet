import type { Metadata } from "next";

import { PageHeader } from "@/components/common/PageHeader";
import { MyWorkList, type MyWorkItem } from "@/components/tasks/MyWorkList";
import { formatDate } from "@/lib/format";
import { vi } from "@/lib/i18n/vi";
import { requirePermission } from "@/server/auth/current-user";
import { myWork } from "@/server/tasks/my-work";

export const metadata: Metadata = { title: vi.nav.myWork };

/** Việc của tôi (Mục 5.3) — trang mặc định của cán bộ (OFFICER) */
export default async function MyWorkPage() {
  const user = await requirePermission("myWork.view");
  const { items, toApprove } = await myWork(user);
  return (
    <>
      <PageHeader
        title={vi.nav.myWork}
        description={`Công việc và báo cáo của ${user.fullName}${user.departmentName ? ` và ${user.departmentName}` : ""}, sắp theo hạn gần nhất.`}
      />
      <MyWorkList
        items={items.map((i): MyWorkItem =>
          i.kind === "task"
            ? {
                kind: "task",
                id: i.id,
                title: i.title,
                context: i.document
                  ? `Từ ${i.document.number ?? i.document.title}`
                  : `Giao bởi ${i.assigner}`,
                dueDate: i.dueDate ? formatDate(i.dueDate) : null,
                daysLeft: i.daysLeft,
                status: i.status,
                flow: i.flow,
                progress: i.progress,
                canAct: i.canAct,
              }
            : {
                kind: "report",
                id: i.id,
                title: `${i.requirement.name} — ${i.label}`,
                context: `${i.department.name}${i.requirement.recipientAgency ? ` → ${i.requirement.recipientAgency.name}` : ""}`,
                dueDate: formatDate(i.dueDate),
                daysLeft: i.daysLeft,
                status: i.status,
                canAct: i.canAct,
              },
        )}
        approvals={toApprove.map((t) => ({
          id: t.id,
          title: t.title,
          lead: t.lead,
          flow: t.flow,
          pendingExtension: t.pendingExtension,
        }))}
      />
    </>
  );
}
