"use client";

import { ClipboardList, ListTodo } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { DueText, ProgressBar, STATUS_ICONS, StatusBadge } from "@/components/common/StatusBadge";
import { SubmitReportDialog, type SubmitTarget } from "@/components/reports/SubmitReportDialog";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";
import { FLOW_LABELS, type DueStatus } from "@/lib/status";
import { cn } from "@/lib/utils";

import { TaskActions } from "./TaskActions";

export type MyWorkItem =
  | {
      kind: "task";
      id: string;
      title: string;
      context: string;
      dueDate: string | null;
      daysLeft: number | null;
      status: DueStatus | null;
      flow: keyof typeof FLOW_LABELS;
      progress: number;
      canAct: boolean;
    }
  | {
      kind: "report";
      id: string;
      title: string;
      context: string;
      dueDate: string;
      daysLeft: number;
      status: DueStatus;
      canAct: boolean;
    };

export type ApprovalItem = {
  id: string;
  title: string;
  lead: string;
  flow: keyof typeof FLOW_LABELS;
  pendingExtension: boolean;
};

type Bucket = "QUA_HAN" | "SAP_DEN_HAN" | "DANG_LAM";

/** Nhóm thẻ đầu trang: Quá hạn / Sắp đến hạn / Đang làm (gồm cả việc không đặt hạn) */
function bucketOf(item: MyWorkItem): Bucket | null {
  if (item.status === "QUA_HAN") return "QUA_HAN";
  if (item.status === "SAP_DEN_HAN") return "SAP_DEN_HAN";
  if (item.status === "CHUA_DEN_HAN" || item.status === "KHONG_HAN") return "DANG_LAM";
  return null; // đã báo hoàn thành, chờ duyệt
}

const CARDS: { key: Bucket; label: string; color: string; icon: DueStatus }[] = [
  { key: "QUA_HAN", label: "Quá hạn", color: "var(--status-overdue)", icon: "QUA_HAN" },
  {
    key: "SAP_DEN_HAN",
    label: "Sắp đến hạn",
    color: "var(--status-due-soon)",
    icon: "SAP_DEN_HAN",
  },
  { key: "DANG_LAM", label: "Đang làm", color: "var(--status-in-progress)", icon: "CHUA_DEN_HAN" },
];

function CardIcon({ status }: { status: DueStatus }) {
  const Icon = STATUS_ICONS[status];
  return <Icon className="hidden size-5 shrink-0 sm:block" aria-hidden />;
}

export function MyWorkList({
  items,
  approvals,
}: {
  items: MyWorkItem[];
  approvals: ApprovalItem[];
}) {
  const [bucket, setBucket] = useState<Bucket | null>(null);
  const [submitting, setSubmitting] = useState<SubmitTarget | null>(null);
  const shown = bucket ? items.filter((i) => bucketOf(i) === bucket) : items;

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Tổng hợp việc" className="grid grid-cols-3 gap-2 sm:gap-4">
        {CARDS.map((c) => {
          const count = items.filter((i) => bucketOf(i) === c.key).length;
          const active = bucket === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setBucket(active ? null : c.key)}
              aria-pressed={active}
              className={cn(
                "flex flex-col items-start rounded-xl border-2 bg-card p-3 text-left shadow-sm transition hover:shadow-md sm:p-5",
                active ? "ring-2 ring-offset-2" : "border-transparent",
              )}
              style={{
                borderColor: active ? c.color : undefined,
                ["--tw-ring-color" as string]: c.color,
              }}
              data-testid={`card-${c.key}`}
            >
              <span
                className="flex items-center gap-1.5 font-semibold sm:text-lg"
                style={{ color: c.color }}
              >
                <CardIcon status={c.icon} />
                {c.label}
              </span>
              <span className="text-stat font-bold tabular-nums" style={{ color: c.color }}>
                {formatNumber(count)}
              </span>
              <span className="hidden text-muted-foreground sm:block">
                {active ? "Bấm để bỏ lọc" : "Bấm để xem danh sách"}
              </span>
            </button>
          );
        })}
      </section>

      {approvals.length > 0 && (
        <section className="rounded-xl border border-status-due-soon/50 bg-status-due-soon/5 p-4">
          <h2 className="mb-2 text-lg font-semibold">Chờ tôi duyệt ({approvals.length})</h2>
          <ul className="flex flex-col gap-1">
            {approvals.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/cong-viec/${a.id}`}
                  className="font-medium text-brand underline-offset-4 hover:underline"
                >
                  {a.title}
                </Link>
                <span className="text-muted-foreground">
                  {" "}
                  — {a.lead} · {a.flow === "SUBMITTED" ? "báo hoàn thành" : ""}
                  {a.flow === "SUBMITTED" && a.pendingExtension ? ", " : ""}
                  {a.pendingExtension ? "đề nghị gia hạn" : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Danh sách việc cần làm">
        <h2 className="mb-3 text-lg font-semibold">
          {bucket ? CARDS.find((c) => c.key === bucket)!.label : "Tất cả việc cần làm"} (
          {shown.length})
        </h2>
        {shown.length === 0 ? (
          <p className="rounded-xl border bg-card p-6 text-center text-muted-foreground">
            Không có việc nào. Tốt lắm!
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {shown.map((item) => (
              <li
                key={`${item.kind}-${item.id}`}
                className={cn(
                  "flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4 shadow-sm",
                  item.status === "QUA_HAN" && "border-status-overdue/40",
                )}
              >
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand"
                  aria-hidden
                >
                  {item.kind === "task" ? (
                    <ListTodo className="size-5" />
                  ) : (
                    <ClipboardList className="size-5" />
                  )}
                </span>
                <div className="min-w-0 flex-1 basis-64">
                  <p className="text-sm text-muted-foreground">
                    {item.kind === "task" ? "Công việc" : "Báo cáo"} · {item.context}
                  </p>
                  {item.kind === "task" ? (
                    <Link
                      href={`/cong-viec/${item.id}`}
                      className="font-semibold text-brand underline-offset-4 hover:underline"
                    >
                      {item.title}
                    </Link>
                  ) : (
                    <span className="font-semibold">{item.title}</span>
                  )}
                  <p className="flex flex-wrap items-center gap-x-2 text-[0.9375rem]">
                    <span>Hạn: {item.dueDate ?? "không đặt"}</span>
                    <DueText daysLeft={item.daysLeft} status={item.status} />
                    {item.kind === "task" && item.flow === "SUBMITTED" && (
                      <span className="text-muted-foreground">· {FLOW_LABELS.SUBMITTED}</span>
                    )}
                  </p>
                </div>
                <StatusBadge status={item.status} context={item.kind} />
                {item.kind === "task" && <ProgressBar value={item.progress} />}
                {item.canAct &&
                  (item.kind === "task" ? (
                    <TaskActions
                      taskId={item.id}
                      title={item.title}
                      flow={item.flow}
                      progress={item.progress}
                      dueDate={null}
                      permissions={{ canUpdate: true, canApprove: false, pendingExtension: null }}
                      compact
                    />
                  ) : (
                    <Button
                      size="sm"
                      onClick={() =>
                        setSubmitting({
                          periodId: item.id,
                          title: item.title,
                          dueDate: item.dueDate,
                          submission: null,
                        })
                      }
                    >
                      Nộp báo cáo
                    </Button>
                  ))}
              </li>
            ))}
          </ul>
        )}
      </section>
      {submitting && <SubmitReportDialog target={submitting} onClose={() => setSubmitting(null)} />}
    </div>
  );
}
