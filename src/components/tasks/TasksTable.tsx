"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Download, Plus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { DataTable } from "@/components/common/DataTable";
import type { Option } from "@/components/common/EntityForm";
import { DueText, ProgressBar, StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { PRIORITY_LABELS } from "@/lib/schemas/task";
import { FLOW_LABELS, STATUS_RANK, statusLabel, type DueStatus } from "@/lib/status";

import { TaskFormDialog, type TaskFormOptions } from "./TaskFormDialog";

export type TaskRow = {
  id: string;
  title: string;
  document: { id: string; number: string | null; title: string } | null;
  assigner: string;
  lead: string;
  leadDepartmentId: string | null;
  dueDate: string | null;
  dueSort: string;
  daysLeft: number | null;
  priority: keyof typeof PRIORITY_LABELS;
  flow: keyof typeof FLOW_LABELS;
  progress: number;
  status: DueStatus | null;
  pendingExtension: boolean;
  /** "YYYY-MM" (giờ VN) — lọc theo tháng từ biểu đồ bảng điều hành */
  createdMonth: string;
  completedMonth: string | null;
};

const COLUMNS: ColumnDef<TaskRow, unknown>[] = [
  {
    accessorKey: "title",
    header: "Công việc",
    meta: { hideOnCard: true },
    cell: ({ row }) => (
      <div className="flex min-w-56 flex-col">
        <Link
          href={`/cong-viec/${row.original.id}`}
          className="font-medium text-brand underline-offset-4 hover:underline"
        >
          {row.original.title}
        </Link>
        {row.original.document && (
          <span className="text-sm text-muted-foreground">
            Từ: {row.original.document.number ?? row.original.document.title}
          </span>
        )}
      </div>
    ),
  },
  { accessorKey: "lead", header: "Chủ trì" },
  {
    id: "due",
    accessorFn: (r) => r.dueSort,
    header: "Hạn",
    cell: ({ row }) => (
      <div className="flex flex-col whitespace-nowrap">
        <span>{row.original.dueDate ?? "Không hạn"}</span>
        <DueText daysLeft={row.original.daysLeft} status={row.original.status} />
      </div>
    ),
  },
  {
    id: "status",
    accessorFn: (r) => (r.status ? STATUS_RANK[r.status] : 9),
    header: "Trạng thái",
    cell: ({ row }) => (
      <div className="flex flex-col items-start gap-1">
        <StatusBadge status={row.original.status} />
        <span className="text-sm text-muted-foreground">
          {FLOW_LABELS[row.original.flow]}
          {row.original.pendingExtension && " · chờ gia hạn"}
        </span>
      </div>
    ),
  },
  {
    accessorKey: "progress",
    header: "Tiến độ",
    cell: ({ row }) => <ProgressBar value={row.original.progress} />,
  },
  {
    accessorKey: "priority",
    header: "Ưu tiên",
    cell: ({ row }) => PRIORITY_LABELS[row.original.priority],
  },
  { accessorKey: "assigner", header: "Người giao" },
];

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "MO", label: "Chưa xong (mọi trạng thái)" },
  { value: "DANG_LAM", label: "Đang làm (chưa đến hạn + không hạn)" },
  ...(
    [
      "QUA_HAN",
      "SAP_DEN_HAN",
      "CHUA_DEN_HAN",
      "KHONG_HAN",
      "HOAN_THANH",
      "HOAN_THANH_TRE",
    ] as DueStatus[]
  ).map((s) => ({
    value: s,
    label: statusLabel(s),
  })),
  { value: "XONG", label: "Đã xong (đúng + trễ hạn)" },
  { value: "HUY", label: "Đã huỷ" },
];

type Props = {
  rows: TaskRow[];
  canAssign: boolean;
  options: TaskFormOptions;
  initial: {
    status?: string;
    flow?: string;
    department?: string;
    /** ?giao=YYYY-MM: giao trong tháng; ?xong=YYYY-MM: hoàn thành trong tháng */
    assignedMonth?: string;
    completedMonth?: string;
  };
};

const monthText = (key: string) => {
  const [y, m] = key.split("-");
  return `${m}/${y}`;
};

export function TasksTable({ rows, canAssign, options, initial }: Props) {
  const [status, setStatus] = useState(initial.status ?? "");
  const [flow, setFlow] = useState(initial.flow ?? "");
  const [department, setDepartment] = useState(initial.department ?? "");
  const [month, setMonth] = useState<{ kind: "giao" | "xong"; key: string } | null>(
    initial.assignedMonth
      ? { kind: "giao", key: initial.assignedMonth }
      : initial.completedMonth
        ? { kind: "xong", key: initial.completedMonth }
        : null,
  );
  const [assigning, setAssigning] = useState(false);

  const shown = useMemo(
    () =>
      rows.filter((r) => {
        const done = r.status === "HOAN_THANH" || r.status === "HOAN_THANH_TRE";
        const statusOk =
          !status ||
          (status === "MO" && r.status !== null && !done) ||
          (status === "DANG_LAM" &&
            (r.flow === "NEW" || r.flow === "IN_PROGRESS") &&
            (r.status === "CHUA_DEN_HAN" || r.status === "KHONG_HAN")) ||
          (status === "XONG" && r.flow === "DONE") ||
          (status === "HUY" && r.status === null) ||
          r.status === status;
        return (
          statusOk &&
          (!flow || r.flow === flow) &&
          (!department || r.leadDepartmentId === department) &&
          (!month ||
            (month.kind === "giao" ? r.createdMonth === month.key : r.completedMonth === month.key))
        );
      }),
    [rows, status, flow, department, month],
  );

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
    <>
      {month && (
        <p className="mb-3 flex w-fit items-center gap-2 rounded-full bg-brand-soft px-3 py-1 font-medium text-brand">
          {month.kind === "giao" ? "Giao trong tháng" : "Hoàn thành trong tháng"}{" "}
          {monthText(month.key)}
          <button
            type="button"
            className="rounded-full px-1 hover:bg-white"
            onClick={() => setMonth(null)}
            aria-label="Bỏ lọc theo tháng"
          >
            ✕
          </button>
        </p>
      )}
      <DataTable
        columns={COLUMNS}
        data={shown}
        searchText={(r) =>
          `${r.title} ${r.lead} ${r.assigner} ${r.document?.number ?? ""} ${r.document?.title ?? ""}`
        }
        searchPlaceholder="Tìm công việc…"
        emptyMessage="Không có công việc nào."
        cardTitle={(r) => r.title}
        rowClassName={(r) => (r.status === "QUA_HAN" ? "bg-status-overdue/5" : undefined)}
        toolbar={
          <>
            {sel("Lọc theo trạng thái", status, setStatus, STATUS_FILTERS, "Mọi trạng thái")}
            {sel(
              "Lọc theo bước xử lý",
              flow,
              setFlow,
              Object.entries(FLOW_LABELS).map(([value, label]) => ({ value, label })),
              "Mọi bước xử lý",
            )}
            {sel(
              "Lọc theo đơn vị chủ trì",
              department,
              setDepartment,
              options.departments,
              "Mọi đơn vị",
            )}
            <Button variant="outline" asChild>
              <a href="/api/export/tasks" download>
                <Download aria-hidden />
                Xuất Excel
              </a>
            </Button>
            {canAssign && (
              <Button onClick={() => setAssigning(true)}>
                <Plus aria-hidden />
                Giao việc
              </Button>
            )}
          </>
        }
      />
      {assigning && <TaskFormDialog open onOpenChange={setAssigning} options={options} />}
    </>
  );
}
