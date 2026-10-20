"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { ActiveBadge } from "@/components/common/ActiveBadge";
import { CrudTable } from "@/components/common/CrudTable";
import type { FieldConfig } from "@/components/common/EntityForm";
import { formatNumber } from "@/lib/format";
import { departmentSchema } from "@/lib/schemas/catalog";
import { deleteDepartment, saveDepartment } from "@/server/actions/catalog";

export type DepartmentRow = {
  id: string;
  name: string;
  shortName: string | null;
  sortOrder: number;
  active: boolean;
  userCount: number;
};

const COLUMNS: ColumnDef<DepartmentRow, unknown>[] = [
  { accessorKey: "sortOrder", header: "Thứ tự", meta: { align: "right", className: "w-24" } },
  { accessorKey: "name", header: "Tên đơn vị", meta: { hideOnCard: true } },
  { accessorKey: "shortName", header: "Viết tắt" },
  {
    accessorKey: "userCount",
    header: "Số người dùng",
    meta: { align: "right" },
    cell: ({ getValue }) => formatNumber(getValue() as number),
  },
  {
    accessorKey: "active",
    header: "Trạng thái",
    cell: ({ row }) => <ActiveBadge active={row.original.active} />,
  },
];

const FIELDS: FieldConfig[] = [
  { name: "name", label: "Tên đơn vị", required: true, wide: true },
  { name: "shortName", label: "Tên viết tắt", placeholder: "VD: VP HĐND-UBND" },
  { name: "sortOrder", label: "Thứ tự hiển thị", type: "number", hint: "Số nhỏ hiển thị trước." },
  { name: "active", label: "Trạng thái", type: "checkbox", placeholder: "Đang sử dụng" },
];

export function DepartmentsTable({ rows }: { rows: DepartmentRow[] }) {
  return (
    <CrudTable
      entityName="đơn vị"
      rows={rows}
      columns={COLUMNS}
      canManage
      fields={() => FIELDS}
      schema={() => departmentSchema}
      toFormValues={(r) => ({
        id: r?.id ?? "",
        name: r?.name ?? "",
        shortName: r?.shortName ?? "",
        sortOrder: r ? String(r.sortOrder) : String((rows.at(-1)?.sortOrder ?? 0) + 1),
        active: r?.active ?? true,
      })}
      save={(values) => saveDepartment(values as never)}
      remove={(r) => deleteDepartment({ id: r.id })}
      deleteDescription={(r) =>
        r.userCount > 0
          ? `Đơn vị đang có ${r.userCount} người dùng nên không xoá được. Hãy chuyển người dùng sang đơn vị khác hoặc đặt đơn vị “Ngừng sử dụng”.`
          : "Đơn vị sẽ bị xoá vĩnh viễn. Nếu đơn vị đã gắn với văn bản/công việc, hệ thống sẽ từ chối xoá."
      }
      rowLabel={(r) => r.name}
      searchText={(r) => `${r.name} ${r.shortName ?? ""}`}
      exportHref="/api/export/departments"
    />
  );
}
