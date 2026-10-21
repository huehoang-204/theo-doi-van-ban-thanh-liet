"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";

import { ActiveBadge } from "@/components/common/ActiveBadge";
import { CrudTable } from "@/components/common/CrudTable";
import type { FieldConfig, Option } from "@/components/common/EntityForm";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { formatNumber } from "@/lib/format";
import { residentialSchema } from "@/lib/schemas/catalog";
import { deleteResidential, saveResidential } from "@/server/actions/residentials";

export type ResidentialRow = {
  id: string;
  name: string;
  code: number | null;
  oldAreaId: string | null;
  oldAreaName: string | null;
  leaderName: string | null;
  leaderPhone: string | null;
  households: number | null;
  population: number | null;
  partyOrgId: string | null;
  partyOrgName: string | null;
  note: string | null;
  active: boolean;
};

const num = (v: unknown) => (v === null || v === undefined ? "—" : formatNumber(v as number));

const COLUMNS: ColumnDef<ResidentialRow, unknown>[] = [
  {
    accessorKey: "code",
    header: "STT",
    meta: { align: "right", className: "w-16" },
    cell: ({ getValue }) => num(getValue()),
  },
  { accessorKey: "name", header: "Tên TDP", meta: { hideOnCard: true } },
  {
    accessorKey: "oldAreaName",
    header: "Khu vực cũ",
    cell: ({ getValue }) => (getValue() as string | null) ?? "—",
  },
  {
    accessorKey: "leaderName",
    header: "Tổ trưởng",
    cell: ({ row }) =>
      row.original.leaderName ? (
        <span>
          {row.original.leaderName}
          {row.original.leaderPhone && (
            <span className="block text-muted-foreground">{row.original.leaderPhone}</span>
          )}
        </span>
      ) : (
        "—"
      ),
  },
  {
    accessorKey: "households",
    header: "Số hộ",
    meta: { align: "right" },
    cell: ({ getValue }) => num(getValue()),
  },
  {
    accessorKey: "population",
    header: "Nhân khẩu",
    meta: { align: "right" },
    cell: ({ getValue }) => num(getValue()),
  },
  {
    accessorKey: "partyOrgName",
    header: "Chi bộ phụ trách",
    cell: ({ getValue }) => (getValue() as string | null) ?? "—",
  },
  {
    accessorKey: "active",
    header: "Trạng thái",
    cell: ({ row }) => (
      <ActiveBadge active={row.original.active} on="Đang hoạt động" off="Ngừng hoạt động" />
    ),
  },
];

type Props = {
  rows: ResidentialRow[];
  canManage: boolean;
  oldAreas: Option[];
  partyOrgs: Option[];
  /** Lọc khu vực cũ từ URL (bảng điều hành) */
  initialArea?: string;
};

export function ResidentialsTable({ rows, canManage, oldAreas, partyOrgs, initialArea }: Props) {
  const [area, setArea] = useState(initialArea ?? "");
  const shown = useMemo(
    () => (area ? rows.filter((r) => r.oldAreaId === area) : rows),
    [rows, area],
  );
  const active = shown.filter((r) => r.active);
  const sum = (f: (r: ResidentialRow) => number | null) =>
    formatNumber(active.reduce((s, r) => s + (f(r) ?? 0), 0));

  const fields: FieldConfig[] = [
    { name: "name", label: "Tên tổ dân phố", required: true, placeholder: "VD: Tổ dân phố số 1" },
    { name: "code", label: "Số thứ tự", type: "number", hint: "Dùng để sắp xếp danh sách." },
    { name: "oldAreaId", label: "Khu vực cũ (trước sáp nhập)", type: "select", options: oldAreas },
    { name: "partyOrgId", label: "Chi bộ phụ trách", type: "select", options: partyOrgs },
    { name: "leaderName", label: "Tổ trưởng" },
    { name: "leaderPhone", label: "SĐT tổ trưởng", type: "tel" },
    { name: "households", label: "Số hộ", type: "number" },
    { name: "population", label: "Số nhân khẩu", type: "number" },
    { name: "note", label: "Ghi chú", type: "textarea" },
    { name: "active", label: "Trạng thái", type: "checkbox", placeholder: "Đang hoạt động" },
  ];

  return (
    <CrudTable
      entityName="tổ dân phố"
      rows={shown}
      columns={COLUMNS}
      canManage={canManage}
      fields={() => fields}
      schema={() => residentialSchema}
      toFormValues={(r) => ({
        id: r?.id ?? "",
        name: r?.name ?? "",
        code: r?.code?.toString() ?? String(Math.max(0, ...rows.map((x) => x.code ?? 0)) + 1),
        oldAreaId: r?.oldAreaId ?? area,
        partyOrgId: r?.partyOrgId ?? "",
        leaderName: r?.leaderName ?? "",
        leaderPhone: r?.leaderPhone ?? "",
        households: r?.households?.toString() ?? "",
        population: r?.population?.toString() ?? "",
        note: r?.note ?? "",
        active: r?.active ?? true,
      })}
      save={(values) => saveResidential(values as never)}
      remove={(r) => deleteResidential({ id: r.id })}
      deleteDescription={() =>
        "Tổ dân phố sẽ bị xoá vĩnh viễn. Nếu chỉ tạm ngừng, hãy sửa và bỏ chọn “Đang hoạt động”."
      }
      rowLabel={(r) => r.name}
      searchText={(r) =>
        `${r.name} ${r.leaderName ?? ""} ${r.oldAreaName ?? ""} ${r.partyOrgName ?? ""}`
      }
      exportHref="/api/export/residentials"
      importKind="residentials"
      rowClassName={(r) => (r.active ? undefined : "opacity-60")}
      footer={[
        "",
        `Tổng: ${formatNumber(active.length)} TDP`,
        "",
        "",
        sum((r) => r.households),
        sum((r) => r.population),
        "",
        "",
        ...(canManage ? [""] : []),
      ]}
      toolbarExtra={
        <NativeSelect
          value={area}
          onChange={(e) => setArea(e.target.value)}
          aria-label="Lọc theo khu vực cũ"
          className="min-w-48"
        >
          <NativeSelectOption value="">Tất cả khu vực</NativeSelectOption>
          {oldAreas.map((a) => (
            <NativeSelectOption key={a.value} value={a.value}>
              {a.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      }
    />
  );
}
