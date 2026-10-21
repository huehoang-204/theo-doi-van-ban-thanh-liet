"use client";

import { ClipboardPlus, ExternalLink, Pencil, Send, UserPlus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { DueText, ProgressBar, StatusBadge } from "@/components/common/StatusBadge";
import {
  RequirementFormDialog,
  type RequirementEditValues,
  type RequirementOptions,
} from "@/components/reports/RequirementFormDialog";
import { SubmitReportDialog, type SubmitTarget } from "@/components/reports/SubmitReportDialog";
import { TaskFormDialog, type TaskFormOptions } from "@/components/tasks/TaskFormDialog";
import type { TaskRow } from "@/components/tasks/TasksTable";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";
import { describeRule } from "@/lib/report-periods";
import { FLOW_LABELS, type DueStatus } from "@/lib/status";

/** Nút "Giao việc" từ văn bản (QT-02) */
export function AssignTaskButton({
  document,
  options,
}: {
  document: { id: string; label: string };
  options: TaskFormOptions;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <UserPlus aria-hidden />
        Giao việc
      </Button>
      {open && (
        <TaskFormDialog open onOpenChange={setOpen} options={options} fromDocument={document} />
      )}
    </>
  );
}

export function DocumentTasksTab({
  tasks,
  assign,
}: {
  tasks: TaskRow[];
  assign: { document: { id: string; label: string }; options: TaskFormOptions } | null;
}) {
  return (
    <div className="flex flex-col gap-3">
      {assign && (
        <div>
          <AssignTaskButton {...assign} />
        </div>
      )}
      {tasks.length === 0 ? (
        <p className="text-muted-foreground">Chưa có công việc nào giao từ văn bản này.</p>
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border">
          {tasks.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <Link
                  href={`/cong-viec/${t.id}`}
                  className="font-medium text-brand underline-offset-4 hover:underline"
                >
                  {t.title}
                </Link>
                <p className="text-sm text-muted-foreground">
                  Chủ trì: {t.lead} · Hạn: {t.dueDate ?? "không đặt"} · {FLOW_LABELS[t.flow]}
                </p>
              </div>
              <DueText daysLeft={t.daysLeft} status={t.status} />
              <StatusBadge status={t.status} />
              <ProgressBar value={t.flow === "CANCELLED" ? null : t.progress} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export type RequirementView = RequirementEditValues & {
  recipient: string | null;
  follower: string | null;
  departmentNames: string[];
  stats: { total: number; submitted: number; late: number; overdue: number; dueSoon: number };
  upcoming: {
    id: string;
    label: string;
    department: string;
    dueDate: string;
    daysLeft: number;
    status: DueStatus;
    canSubmit: boolean;
  }[];
};

export function DocumentReportsTab({
  documentId,
  requirements,
  options,
}: {
  documentId: string;
  requirements: RequirementView[];
  options: RequirementOptions | null;
}) {
  const [editing, setEditing] = useState<RequirementView | null | "new">(null);
  const [submitting, setSubmitting] = useState<SubmitTarget | null>(null);
  return (
    <div className="flex flex-col gap-3">
      {options && (
        <div>
          <Button variant="outline" onClick={() => setEditing("new")}>
            <ClipboardPlus aria-hidden />
            Yêu cầu báo cáo
          </Button>
        </div>
      )}
      {requirements.length === 0 && (
        <p className="text-muted-foreground">Văn bản này không đặt yêu cầu báo cáo.</p>
      )}
      {requirements.map((r) => (
        <section key={r.id} className="rounded-xl border p-4" aria-label={r.name}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-lg font-semibold">
                {r.name}
                {!r.active && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    (ngừng áp dụng)
                  </span>
                )}
              </h3>
              <p className="text-muted-foreground">
                {describeRule(r)}
                {r.recipient && ` · Nơi nhận: ${r.recipient}`}
                {r.follower && ` · Theo dõi: ${r.follower}`}
              </p>
              <p className="text-muted-foreground">
                Đơn vị báo cáo: {r.departmentNames.join("; ")}
              </p>
            </div>
            <div className="flex gap-2">
              {options && (
                <Button variant="ghost" size="sm" onClick={() => setEditing(r)}>
                  <Pencil aria-hidden />
                  Sửa
                </Button>
              )}
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/bao-cao?yeuCau=${r.id}`}>
                  <ExternalLink aria-hidden />
                  Mọi kỳ
                </Link>
              </Button>
            </div>
          </div>
          <p className="mt-2" data-testid="requirement-stats">
            {formatNumber(r.stats.total)} kỳ · đã nộp {formatNumber(r.stats.submitted)}
            {r.stats.late > 0 && ` (trễ ${r.stats.late})`} · quá hạn chưa nộp{" "}
            {formatNumber(r.stats.overdue)} · sắp đến hạn {formatNumber(r.stats.dueSoon)}
          </p>
          {r.upcoming.length > 0 && (
            <ul className="mt-2 flex flex-col divide-y rounded-lg border">
              {r.upcoming.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                  <span className="min-w-0 flex-1">
                    {p.label} — {p.department} · hạn {p.dueDate}
                  </span>
                  <DueText daysLeft={p.daysLeft} status={p.status} />
                  <StatusBadge status={p.status} context="report" />
                  {p.canSubmit && (
                    <Button
                      size="sm"
                      onClick={() =>
                        setSubmitting({
                          periodId: p.id,
                          title: `${r.name} — ${p.label} — ${p.department}`,
                          dueDate: p.dueDate,
                          submission: null,
                        })
                      }
                    >
                      <Send aria-hidden />
                      Nộp
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
      {options && editing && (
        <RequirementFormDialog
          open
          onOpenChange={(o) => !o && setEditing(null)}
          documentId={documentId}
          options={options}
          requirement={editing === "new" ? undefined : editing}
        />
      )}
      {submitting && <SubmitReportDialog target={submitting} onClose={() => setSubmitting(null)} />}
    </div>
  );
}
