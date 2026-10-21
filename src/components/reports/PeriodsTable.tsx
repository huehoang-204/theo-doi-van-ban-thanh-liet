"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Download, LockOpen, Paperclip, Pencil, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/common/DataTable";
import type { Option } from "@/components/common/EntityForm";
import { DueText, StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { STATUS_RANK, statusLabel, type DueStatus } from "@/lib/status";
import { cn } from "@/lib/utils";
import { unlockSubmission } from "@/server/actions/reports";

import { SubmitReportDialog, type SubmitTarget } from "./SubmitReportDialog";

export type PeriodRow = {
  id: string;
  label: string;
  dueDate: string;
  dueSort: string;
  daysLeft: number;
  status: DueStatus;
  requirement: { id: string; name: string; recipient: string | null };
  document: { id: string; number: string | null; title: string };
  department: { id: string; name: string };
  submission: {
    id: string;
    number: string | null;
    sentDate: string;
    note: string | null;
    submittedBy: string;
    linkedDocumentId: string | null;
    attachments: { id: string; fileName: string }[];
  } | null;
  canSubmit: boolean;
  editable: boolean;
  /** Quá hạn hoặc trong 60 ngày tới */
  upcoming: boolean;
};

type Tab = "can-nop" | "da-nop" | "tat-ca";

type Props = {
  rows: PeriodRow[];
  canUnlock: boolean;
  departments: Option[];
  requirements: Option[];
  initial: { requirement?: string; status?: string; withinDays?: number };
};

export function PeriodsTable({ rows, canUnlock, departments, requirements, initial }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(initial.requirement || initial.status ? "tat-ca" : "can-nop");
  const [requirement, setRequirement] = useState(initial.requirement ?? "");
  const [department, setDepartment] = useState("");
  const [status, setStatus] = useState(initial.status ?? "");
  const [withinDays, setWithinDays] = useState<number | null>(initial.withinDays ?? null);
  const [submitting, setSubmitting] = useState<SubmitTarget | null>(null);

  const shown = useMemo(
    () =>
      rows.filter(
        (r) =>
          (tab === "tat-ca" ||
            (tab === "can-nop" ? !r.submission && r.upcoming : !!r.submission)) &&
          (!requirement || r.requirement.id === requirement) &&
          (!department || r.department.id === department) &&
          (!status || r.status === status) &&
          (withinDays === null || (!r.submission && r.daysLeft <= withinDays)),
      ),
    [rows, tab, requirement, department, status, withinDays],
  );

  const columns = useMemo<ColumnDef<PeriodRow, unknown>[]>(
    () => [
      {
        id: "report",
        accessorFn: (r) => `${r.requirement.name} ${r.label}`,
        header: "Báo cáo",
        meta: { hideOnCard: true },
        cell: ({ row }) => (
          <div className="flex min-w-56 flex-col">
            <span className="font-medium">{row.original.requirement.name}</span>
            <span className="text-sm text-muted-foreground">
              Theo{" "}
              <Link
                href={`/van-ban/${row.original.document.id}`}
                className="text-brand underline-offset-4 hover:underline"
              >
                {row.original.document.number ?? row.original.document.title}
              </Link>
              {row.original.requirement.recipient &&
                ` · Nơi nhận: ${row.original.requirement.recipient}`}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "label",
        header: "Kỳ",
        cell: ({ getValue }) => <span className="whitespace-nowrap">{getValue() as string}</span>,
      },
      { id: "dept", accessorFn: (r) => r.department.name, header: "Đơn vị" },
      {
        id: "due",
        accessorFn: (r) => r.dueSort,
        header: "Hạn",
        cell: ({ row }) => (
          <div className="flex flex-col whitespace-nowrap">
            <span>{row.original.dueDate}</span>
            <DueText daysLeft={row.original.daysLeft} status={row.original.status} />
          </div>
        ),
      },
      {
        id: "status",
        accessorFn: (r) => STATUS_RANK[r.status],
        header: "Trạng thái",
        cell: ({ row }) => <StatusBadge status={row.original.status} context="report" />,
      },
      {
        id: "submission",
        header: "Đã nộp",
        enableSorting: false,
        cell: ({ row }) => {
          const s = row.original.submission;
          if (!s) return <span className="text-muted-foreground">—</span>;
          return (
            <div className="flex flex-col text-[0.9375rem]">
              <span>
                {s.number ? <strong>{s.number}</strong> : "Không số"} · ngày {s.sentDate}
              </span>
              <span className="text-muted-foreground">{s.submittedBy}</span>
              {s.linkedDocumentId && (
                <Link
                  href={`/van-ban/${s.linkedDocumentId}`}
                  className="text-brand underline-offset-4 hover:underline"
                >
                  Xem trên cây văn bản
                </Link>
              )}
              {s.attachments.map((a) => (
                <a
                  key={a.id}
                  href={`/api/files/${a.id}?tai=1`}
                  download
                  className="inline-flex items-center gap-1 text-brand underline-offset-4 hover:underline"
                >
                  <Paperclip className="size-4" aria-hidden />
                  {a.fileName}
                </a>
              ))}
            </div>
          );
        },
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        meta: { align: "right", label: "" },
        cell: ({ row }) => {
          const r = row.original;
          const target: SubmitTarget = {
            periodId: r.id,
            title: `${r.requirement.name} — ${r.label} — ${r.department.name}`,
            dueDate: r.dueDate,
            submission: r.submission && {
              id: r.submission.id,
              number: r.submission.number,
              sentDate: r.submission.sentDate,
              note: r.submission.note,
            },
          };
          return (
            <div className="flex flex-wrap justify-end gap-1">
              {r.canSubmit && !r.submission && (
                <Button size="sm" onClick={() => setSubmitting(target)}>
                  <Send aria-hidden />
                  Nộp báo cáo
                </Button>
              )}
              {r.canSubmit && r.submission && (r.editable || canUnlock) && (
                <Button size="sm" variant="outline" onClick={() => setSubmitting(target)}>
                  <Pencil aria-hidden />
                  Sửa
                </Button>
              )}
              {canUnlock && r.submission && !r.editable && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    const res = await unlockSubmission({ periodId: r.id });
                    if (!res.ok) return void toast.error(res.error.message);
                    toast.success("Đã mở khoá — đơn vị sửa được trong 24 giờ.");
                    router.refresh();
                  }}
                >
                  <LockOpen aria-hidden />
                  Mở khoá
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [canUnlock, router],
  );

  const counts = {
    "can-nop": rows.filter((r) => !r.submission && r.upcoming).length,
    "da-nop": rows.filter((r) => r.submission).length,
    "tat-ca": rows.length,
  };
  const tabs: [Tab, string][] = [
    ["can-nop", `Cần nộp — quá hạn & 60 ngày tới (${counts["can-nop"]})`],
    ["da-nop", `Đã nộp (${counts["da-nop"]})`],
    ["tat-ca", `Tất cả kỳ (${counts["tat-ca"]})`],
  ];

  const sel = (
    label: string,
    value: string,
    set: (v: string) => void,
    opts: Option[],
    all: string,
  ) => (
    <NativeSelect
      value={value}
      onChange={(e) => set(e.target.value)}
      aria-label={label}
      className="max-w-64"
    >
      <NativeSelectOption value="">{all}</NativeSelectOption>
      {opts.map((o) => (
        <NativeSelectOption key={o.value} value={o.value}>
          {o.label}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );

  return (
    <div className="flex flex-col gap-3">
      <div
        role="tablist"
        aria-label="Nhóm kỳ báo cáo"
        className="inline-flex w-fit max-w-full flex-wrap gap-1 rounded-lg bg-muted p-1"
      >
        {tabs.map(([key, text]) => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              "h-10 rounded-md px-3 font-medium",
              tab === key ? "bg-card text-brand shadow-sm" : "text-muted-foreground",
            )}
          >
            {text}
          </button>
        ))}
      </div>
      {withinDays !== null && (
        <p className="flex w-fit items-center gap-2 rounded-full bg-brand-soft px-3 py-1 font-medium text-brand">
          Chưa nộp, hạn trong {withinDays} ngày tới (gồm cả quá hạn)
          <button
            type="button"
            className="rounded-full px-1 hover:bg-white"
            onClick={() => setWithinDays(null)}
            aria-label="Bỏ lọc theo hạn"
          >
            ✕
          </button>
        </p>
      )}
      <DataTable
        columns={columns}
        data={shown}
        searchText={(r) =>
          `${r.requirement.name} ${r.label} ${r.department.name} ${r.document.number ?? ""} ${r.submission?.number ?? ""}`
        }
        searchPlaceholder="Tìm kỳ báo cáo…"
        emptyMessage={
          tab === "can-nop"
            ? "Không có báo cáo nào cần nộp trong 60 ngày tới."
            : "Không có kỳ báo cáo nào."
        }
        cardTitle={(r) => `${r.requirement.name} — ${r.label}`}
        rowClassName={(r) => (r.status === "QUA_HAN" ? "bg-status-overdue/5" : undefined)}
        toolbar={
          <>
            {sel(
              "Lọc theo yêu cầu báo cáo",
              requirement,
              setRequirement,
              requirements,
              "Mọi báo cáo",
            )}
            {sel("Lọc theo đơn vị", department, setDepartment, departments, "Mọi đơn vị")}
            {sel(
              "Lọc theo trạng thái",
              status,
              setStatus,
              (
                [
                  "QUA_HAN",
                  "SAP_DEN_HAN",
                  "CHUA_DEN_HAN",
                  "HOAN_THANH",
                  "HOAN_THANH_TRE",
                ] as DueStatus[]
              ).map((s) => ({ value: s, label: statusLabel(s, "report") })),
              "Mọi trạng thái",
            )}
            <Button variant="outline" asChild>
              <a href="/api/export/reports" download>
                <Download aria-hidden />
                Xuất Excel
              </a>
            </Button>
          </>
        }
      />
      {submitting && <SubmitReportDialog target={submitting} onClose={() => setSubmitting(null)} />}
    </div>
  );
}
