import type { Metadata } from "next";
import { Download, Paperclip } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/common/PageHeader";
import { DueText, ProgressBar, StatusBadge } from "@/components/common/StatusBadge";
import { TaskActions } from "@/components/tasks/TaskActions";
import { formatDate, formatDateTime, daysUntil } from "@/lib/format";
import { formatFileSize } from "@/lib/file-type";
import { can } from "@/lib/permissions";
import { PRIORITY_LABELS } from "@/lib/schemas/task";
import { FLOW_LABELS } from "@/lib/status";
import { requirePermission } from "@/server/auth/current-user";
import { catalogOptions } from "@/server/queries/catalog";
import { getTaskDetail, userOptions } from "@/server/tasks/queries";

export const metadata: Metadata = { title: "Chi tiết công việc" };

const KIND_LABELS: Record<string, string> = {
  ASSIGN: "Giao việc",
  PROGRESS: "Cập nhật tiến độ",
  SUBMIT: "Báo hoàn thành",
  APPROVE: "Duyệt hoàn thành",
  RETURN: "Trả lại",
  EXTENSION_REQUEST: "Đề nghị gia hạn",
  EXTENSION_DECISION: "Xét gia hạn",
  CANCEL: "Huỷ việc",
  EDIT: "Sửa thông tin",
};

const EXT_STATUS: Record<string, string> = {
  PENDING: "Chờ duyệt",
  APPROVED: "Đã đồng ý",
  REJECTED: "Không đồng ý",
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b py-2.5 last:border-b-0 sm:grid-cols-[12rem_1fr]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">
        {children || <span className="text-muted-foreground">—</span>}
      </dd>
    </div>
  );
}

export default async function TaskDetailPage({ params }: PageProps<"/cong-viec/[id]">) {
  const user = await requirePermission("task.list");
  const { id } = await params;
  const detail = await getTaskDetail(user, id);
  if (!detail) notFound();
  const { task, status, resource, coDepartments, coUsers } = detail;
  const canApprove = can(user, "task.approve", resource);
  const pending = task.extensions.find((e) => e.status === "PENDING") ?? null;
  const [options, users] = canApprove
    ? await Promise.all([catalogOptions(), userOptions()])
    : [null, null];

  return (
    <>
      <PageHeader title={task.title} breadcrumbExtra={[{ label: "Chi tiết" }]} />
      <div className="grid gap-6 2xl:grid-cols-[1fr_26rem]">
        <section className="flex flex-col gap-5 rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={status} />
            <span className="rounded-full bg-muted px-3 py-0.5 text-sm font-medium">
              {FLOW_LABELS[task.flow]}
            </span>
            {task.dueDate && <DueText daysLeft={daysUntil(task.dueDate)} status={status} />}
          </div>
          <ProgressBar
            value={task.flow === "CANCELLED" ? null : task.progress}
            className="max-w-md"
          />
          <TaskActions
            taskId={task.id}
            title={task.title}
            flow={task.flow}
            progress={task.progress}
            dueDate={task.dueDate}
            permissions={{
              canUpdate: can(user, "task.updateProgress", resource),
              canApprove,
              pendingExtension: pending
                ? {
                    id: pending.id,
                    newDueDate: pending.newDueDate,
                    reason: pending.reason,
                    requestedBy: pending.requestedBy.fullName,
                  }
                : null,
            }}
            edit={
              options && users
                ? {
                    options: { departments: options.departments, users },
                    task: {
                      id: task.id,
                      title: task.title,
                      description: task.description,
                      document: task.document,
                      leadDepartmentId: task.leadDepartmentId,
                      leadUserId: task.leadUserId,
                      coDepartmentIds: task.coDepartmentIds,
                      coUserIds: task.coUserIds,
                      startDate: task.startDate,
                      dueDate: task.dueDate,
                      priority: task.priority,
                    },
                  }
                : undefined
            }
          />
          <dl>
            <Row label="Văn bản nguồn">
              {task.document && !task.document.deletedAt ? (
                <Link
                  href={`/van-ban/${task.document.id}`}
                  className="text-brand underline-offset-4 hover:underline"
                >
                  {task.document.number
                    ? `${task.document.number} – ${task.document.title}`
                    : task.document.title}
                </Link>
              ) : task.document ? (
                "Văn bản đã bị xoá"
              ) : (
                "Việc phát sinh (không từ văn bản)"
              )}
            </Row>
            <Row label="Mô tả">
              {task.description && <p className="whitespace-pre-line">{task.description}</p>}
            </Row>
            <Row label="Người giao">{task.assigner.fullName}</Row>
            <Row label="Chủ trì">
              {[task.leadUser?.fullName, task.leadDepartment?.name].filter(Boolean).join(" · ")}
            </Row>
            <Row label="Phối hợp">{[...coDepartments, ...coUsers].join("; ")}</Row>
            <Row label="Ngày bắt đầu">{formatDate(task.startDate)}</Row>
            <Row label="Hạn hoàn thành">{formatDate(task.dueDate) || "Không đặt hạn"}</Row>
            <Row label="Mức ưu tiên">{PRIORITY_LABELS[task.priority]}</Row>
            {task.completedAt && (
              <Row label="Hoàn thành lúc">{formatDateTime(task.completedAt)}</Row>
            )}
          </dl>
          {task.extensions.length > 0 && (
            <div>
              <h2 className="mb-2 text-lg font-semibold">Gia hạn</h2>
              <ul className="flex flex-col gap-2">
                {task.extensions.map((e) => (
                  <li key={e.id} className="rounded-lg border p-3">
                    <p>
                      <strong>{EXT_STATUS[e.status]}</strong>: {formatDate(e.oldDueDate)} →{" "}
                      {formatDate(e.newDueDate)}
                    </p>
                    <p className="text-muted-foreground">
                      {e.requestedBy.fullName} · {formatDateTime(e.createdAt)} — {e.reason}
                    </p>
                    {e.decidedBy && (
                      <p className="text-muted-foreground">
                        Xét bởi {e.decidedBy.fullName} · {formatDateTime(e.decidedAt)}
                        {e.decisionNote ? ` — ${e.decisionNote}` : ""}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <aside className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">Quá trình xử lý</h2>
          <ol className="flex flex-col gap-4" aria-label="Quá trình xử lý">
            {task.updates.map((u) => (
              <li key={u.id} className="border-l-2 border-brand-soft pl-3">
                <p className="text-sm text-muted-foreground">
                  {formatDateTime(u.createdAt)} · {u.user.fullName}
                </p>
                <p className="font-medium">
                  {KIND_LABELS[u.kind] ?? u.kind}
                  {(u.kind === "PROGRESS" || u.kind === "SUBMIT") && ` — ${u.progress}%`}
                </p>
                <p className="whitespace-pre-line">{u.content}</p>
                {u.attachments.length > 0 && (
                  <ul className="mt-1 flex flex-col gap-1">
                    {u.attachments.map((a) => (
                      <li key={a.id}>
                        <a
                          href={`/api/files/${a.id}?tai=1`}
                          download
                          className="inline-flex items-center gap-1 text-brand underline-offset-4 hover:underline"
                        >
                          <Paperclip className="size-4" aria-hidden />
                          {a.fileName}
                          <span className="text-sm text-muted-foreground">
                            ({formatFileSize(a.sizeBytes)})
                          </span>
                          <Download className="size-4" aria-hidden />
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </>
  );
}
