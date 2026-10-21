import type { Metadata } from "next";

import { PageHeader } from "@/components/common/PageHeader";
import { TasksTable } from "@/components/tasks/TasksTable";
import { toTaskRow } from "@/server/tasks/rows";
import { vi } from "@/lib/i18n/vi";
import { can } from "@/lib/permissions";
import { requirePermission } from "@/server/auth/current-user";
import { catalogOptions } from "@/server/queries/catalog";
import { listTasks, userOptions } from "@/server/tasks/queries";

export const metadata: Metadata = { title: vi.nav.tasks };

/** Danh sách công việc; tham số URL ?trangThai=QUA_HAN&buoc=SUBMITTED&donVi=<id> để dẫn từ bảng điều hành */
export default async function TasksPage({ searchParams }: PageProps<"/cong-viec">) {
  const user = await requirePermission("task.list");
  const params = await searchParams;
  const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  const [tasks, options, users] = await Promise.all([
    listTasks(user),
    catalogOptions(),
    userOptions(),
  ]);
  return (
    <>
      <PageHeader
        title={vi.nav.tasks}
        description="Việc giao từ văn bản hoặc phát sinh; tiến độ, hạn và kết quả xử lý."
      />
      <TasksTable
        rows={tasks.map(toTaskRow)}
        canAssign={can(user, "task.assign")}
        options={{ departments: options.departments, users }}
        initial={{
          status: str(params.trangThai) ?? "MO",
          flow: str(params.buoc),
          department: str(params.donVi),
        }}
      />
    </>
  );
}
