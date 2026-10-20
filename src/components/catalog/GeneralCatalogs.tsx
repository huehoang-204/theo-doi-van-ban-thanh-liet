"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { ActiveBadge } from "@/components/common/ActiveBadge";
import { CrudTable } from "@/components/common/CrudTable";
import type { FieldConfig } from "@/components/common/EntityForm";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/format";
import { AGENCY_LEVEL_OPTIONS } from "@/lib/i18n/enums";
import {
  documentTypeSchema,
  fieldSchema,
  issuingAgencySchema,
  oldAreaSchema,
} from "@/lib/schemas/catalog";
import {
  deleteDocumentType,
  deleteField,
  deleteIssuingAgency,
  deleteOldArea,
  saveDocumentType,
  saveField,
  saveIssuingAgency,
  saveOldArea,
} from "@/server/actions/catalog";

const count = (label: string) => ({
  header: label,
  meta: { align: "right" as const },
  cell: ({ getValue }: { getValue: () => unknown }) => formatNumber(getValue() as number),
});
const nextOrder = (rows: { sortOrder: number }[]) =>
  String(Math.max(0, ...rows.map((r) => r.sortOrder)) + 1);
const IN_USE_NOTE =
  "Nếu đang được sử dụng, hệ thống sẽ từ chối xoá — khi đó hãy đặt “Ngừng sử dụng”.";

// ---------- Loại văn bản ----------
export type DocumentTypeRow = {
  id: string;
  code: string;
  name: string;
  color: string;
  icon: string;
  isProgram: boolean;
  sortOrder: number;
  active: boolean;
  documentCount: number;
};

const DOC_TYPE_COLUMNS: ColumnDef<DocumentTypeRow, unknown>[] = [
  { accessorKey: "sortOrder", header: "Thứ tự", meta: { align: "right", className: "w-20" } },
  {
    accessorKey: "code",
    header: "Mã",
    cell: ({ row }) => (
      <Badge style={{ backgroundColor: row.original.color }} className="text-white">
        {row.original.code}
      </Badge>
    ),
  },
  { accessorKey: "name", header: "Tên loại văn bản", meta: { hideOnCard: true } },
  {
    accessorKey: "isProgram",
    header: "Dùng cho cấp 1",
    cell: ({ row }) => (row.original.isProgram ? "Chương trình (gốc cây)" : "—"),
  },
  { accessorKey: "documentCount", ...count("Số văn bản") },
  {
    accessorKey: "active",
    header: "Trạng thái",
    cell: ({ row }) => <ActiveBadge active={row.original.active} />,
  },
];

const DOC_TYPE_FIELDS: FieldConfig[] = [
  {
    name: "code",
    label: "Mã",
    required: true,
    placeholder: "VD: KH",
    hint: "Viết tắt theo Nghị định 30/2020/NĐ-CP, chữ không dấu.",
  },
  { name: "name", label: "Tên loại văn bản", required: true },
  { name: "color", label: "Màu nhãn", type: "color", required: true },
  {
    name: "icon",
    label: "Biểu tượng",
    required: true,
    hint: "Tên biểu tượng lucide, VD: file-text, folder, scroll.",
  },
  {
    name: "isProgram",
    label: "Loại gốc cây",
    type: "checkbox",
    placeholder: "Dùng cho cấp 1 (Chương trình)",
    hint: "Cấp 1 của cây văn bản bắt buộc là loại được đánh dấu ở đây.",
  },
  { name: "sortOrder", label: "Thứ tự hiển thị", type: "number" },
  { name: "active", label: "Trạng thái", type: "checkbox", placeholder: "Đang sử dụng" },
];

export function DocumentTypesTable({ rows }: { rows: DocumentTypeRow[] }) {
  return (
    <CrudTable
      entityName="loại văn bản"
      rows={rows}
      columns={DOC_TYPE_COLUMNS}
      canManage
      fields={() => DOC_TYPE_FIELDS}
      schema={() => documentTypeSchema}
      toFormValues={(r) => ({
        id: r?.id ?? "",
        code: r?.code ?? "",
        name: r?.name ?? "",
        color: r?.color ?? "#1E3A8A",
        icon: r?.icon ?? "file-text",
        isProgram: r?.isProgram ?? false,
        sortOrder: r ? String(r.sortOrder) : nextOrder(rows),
        active: r?.active ?? true,
      })}
      save={(values) => saveDocumentType(values as never)}
      remove={(r) => deleteDocumentType({ id: r.id })}
      deleteDescription={(r) =>
        r.documentCount > 0
          ? `Đang có ${r.documentCount} văn bản thuộc loại này nên không xoá được. Hãy đặt “Ngừng sử dụng”.`
          : IN_USE_NOTE
      }
      rowLabel={(r) => r.name}
      searchText={(r) => `${r.code} ${r.name}`}
      exportHref="/api/export/document-types"
    />
  );
}

// ---------- Lĩnh vực ----------
export type FieldRow = {
  id: string;
  name: string;
  sortOrder: number;
  active: boolean;
  documentCount: number;
};

const FIELD_COLUMNS: ColumnDef<FieldRow, unknown>[] = [
  { accessorKey: "sortOrder", header: "Thứ tự", meta: { align: "right", className: "w-20" } },
  { accessorKey: "name", header: "Lĩnh vực", meta: { hideOnCard: true } },
  { accessorKey: "documentCount", ...count("Số văn bản") },
  {
    accessorKey: "active",
    header: "Trạng thái",
    cell: ({ row }) => <ActiveBadge active={row.original.active} />,
  },
];

export function FieldsTable({ rows }: { rows: FieldRow[] }) {
  return (
    <CrudTable
      entityName="lĩnh vực"
      rows={rows}
      columns={FIELD_COLUMNS}
      canManage
      fields={() => [
        { name: "name", label: "Tên lĩnh vực", required: true, wide: true },
        { name: "sortOrder", label: "Thứ tự hiển thị", type: "number" },
        { name: "active", label: "Trạng thái", type: "checkbox", placeholder: "Đang sử dụng" },
      ]}
      schema={() => fieldSchema}
      toFormValues={(r) => ({
        id: r?.id ?? "",
        name: r?.name ?? "",
        sortOrder: r ? String(r.sortOrder) : nextOrder(rows),
        active: r?.active ?? true,
      })}
      save={(values) => saveField(values as never)}
      remove={(r) => deleteField({ id: r.id })}
      deleteDescription={() => IN_USE_NOTE}
      rowLabel={(r) => r.name}
      searchText={(r) => r.name}
      exportHref="/api/export/fields"
    />
  );
}

// ---------- Cơ quan ban hành / nơi nhận báo cáo ----------
export type AgencyRow = {
  id: string;
  name: string;
  level: string | null;
  active: boolean;
  documentCount: number;
};

const AGENCY_COLUMNS: ColumnDef<AgencyRow, unknown>[] = [
  { accessorKey: "name", header: "Tên cơ quan", meta: { hideOnCard: true } },
  {
    accessorKey: "level",
    header: "Cấp",
    cell: ({ getValue }) => (getValue() as string | null) ?? "—",
  },
  { accessorKey: "documentCount", ...count("Số văn bản") },
  {
    accessorKey: "active",
    header: "Trạng thái",
    cell: ({ row }) => <ActiveBadge active={row.original.active} />,
  },
];

export function AgenciesTable({ rows }: { rows: AgencyRow[] }) {
  return (
    <CrudTable
      entityName="cơ quan"
      rows={rows}
      columns={AGENCY_COLUMNS}
      canManage
      fields={() => [
        {
          name: "name",
          label: "Tên cơ quan",
          required: true,
          wide: true,
          hint: "Dùng làm cơ quan ban hành văn bản và nơi nhận báo cáo.",
        },
        {
          name: "level",
          label: "Cấp",
          type: "select",
          options: AGENCY_LEVEL_OPTIONS.map((v) => ({ value: v, label: v })),
        },
        { name: "active", label: "Trạng thái", type: "checkbox", placeholder: "Đang sử dụng" },
      ]}
      schema={() => issuingAgencySchema}
      toFormValues={(r) => ({
        id: r?.id ?? "",
        name: r?.name ?? "",
        level: r?.level ?? "",
        active: r?.active ?? true,
      })}
      save={(values) => saveIssuingAgency(values as never)}
      remove={(r) => deleteIssuingAgency({ id: r.id })}
      deleteDescription={() => IN_USE_NOTE}
      rowLabel={(r) => r.name}
      searchText={(r) => `${r.name} ${r.level ?? ""}`}
      exportHref="/api/export/issuing-agencies"
    />
  );
}

// ---------- Khu vực cũ ----------
export type OldAreaRow = { id: string; name: string; sortOrder: number; residentialCount: number };

const OLD_AREA_COLUMNS: ColumnDef<OldAreaRow, unknown>[] = [
  { accessorKey: "sortOrder", header: "Thứ tự", meta: { align: "right", className: "w-20" } },
  { accessorKey: "name", header: "Khu vực (trước sáp nhập)", meta: { hideOnCard: true } },
  { accessorKey: "residentialCount", ...count("Số TDP") },
];

export function OldAreasTable({ rows }: { rows: OldAreaRow[] }) {
  return (
    <CrudTable
      entityName="khu vực cũ"
      rows={rows}
      columns={OLD_AREA_COLUMNS}
      canManage
      fields={() => [
        {
          name: "name",
          label: "Tên khu vực",
          required: true,
          wide: true,
          hint: "Phường/xã cũ trước sáp nhập 01/07/2025.",
        },
        { name: "sortOrder", label: "Thứ tự hiển thị", type: "number" },
      ]}
      schema={() => oldAreaSchema}
      toFormValues={(r) => ({
        id: r?.id ?? "",
        name: r?.name ?? "",
        sortOrder: r ? String(r.sortOrder) : nextOrder(rows),
      })}
      save={(values) => saveOldArea(values as never)}
      remove={(r) => deleteOldArea({ id: r.id })}
      deleteDescription={(r) =>
        r.residentialCount > 0
          ? `Đang có ${r.residentialCount} tổ dân phố thuộc khu vực này nên không xoá được.`
          : "Khu vực sẽ bị xoá vĩnh viễn."
      }
      rowLabel={(r) => r.name}
      searchText={(r) => r.name}
      exportHref="/api/export/old-areas"
    />
  );
}
