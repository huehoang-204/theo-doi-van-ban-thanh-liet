"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Download, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { z } from "zod";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataTable } from "@/components/common/DataTable";
import type { FieldConfig, FormValues } from "@/components/common/EntityForm";
import { EntityFormDialog } from "@/components/common/EntityFormDialog";
import { ImportDialog } from "@/components/common/ImportDialog";
import { Button } from "@/components/ui/button";
import type { ImportKind } from "@/lib/excel/import-specs";
import type { ActionResult } from "@/server/errors";

export type CrudTableProps<T extends { id: string }> = {
  /** Tên loại bản ghi, viết thường: "trường học", "tổ dân phố"… */
  entityName: string;
  rows: T[];
  columns: ColumnDef<T, unknown>[];
  canManage: boolean;
  fields: (row: T | null) => FieldConfig[];
  schema: (row: T | null) => z.ZodType;
  toFormValues: (row: T | null) => FormValues;
  save: (values: FormValues, row: T | null) => Promise<ActionResult<unknown>>;
  remove?: (row: T) => Promise<ActionResult<unknown>>;
  /** Mô tả hậu quả khi xoá (Mục 8.2.10) */
  deleteDescription?: (row: T) => React.ReactNode;
  rowLabel: (row: T) => string;
  searchText?: (row: T) => string;
  exportHref?: string;
  importKind?: ImportKind;
  /** Nút/bộ lọc thêm trên thanh công cụ */
  toolbarExtra?: React.ReactNode;
  /** Thao tác thêm trên mỗi dòng (VD đặt lại mật khẩu) */
  rowActions?: (row: T) => React.ReactNode;
  footer?: React.ReactNode[];
  paginate?: boolean;
  enableSorting?: boolean;
  emptyMessage?: string;
  rowClassName?: (row: T) => string | undefined;
};

/** Bảng danh mục chuẩn: tìm kiếm, nhập/xuất Excel, thêm/sửa trong hộp thoại, xoá có xác nhận */
export function CrudTable<T extends { id: string }>(props: CrudTableProps<T>) {
  const {
    entityName,
    rows,
    columns,
    canManage,
    fields,
    schema,
    toFormValues,
    save,
    remove,
    deleteDescription,
    rowLabel,
    exportHref,
    importKind,
    toolbarExtra,
    rowActions,
    ...tableProps
  } = props;
  const router = useRouter();
  const [editing, setEditing] = useState<{ row: T | null } | null>(null);
  const [deleting, setDeleting] = useState<T | null>(null);

  const allColumns = useMemo<ColumnDef<T, unknown>[]>(() => {
    if (!canManage && !rowActions) return columns;
    return [
      ...columns,
      {
        id: "thao-tac",
        header: "Thao tác",
        enableSorting: false,
        meta: { align: "right", className: "w-px whitespace-nowrap", label: "" },
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            {rowActions?.(row.original)}
            {canManage && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setEditing({ row: row.original })}
                aria-label={`Sửa ${entityName} ${rowLabel(row.original)}`}
                title="Sửa"
              >
                <Pencil aria-hidden />
              </Button>
            )}
            {canManage && remove && (
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setDeleting(row.original)}
                aria-label={`Xoá ${entityName} ${rowLabel(row.original)}`}
                title="Xoá"
              >
                <Trash2 aria-hidden />
              </Button>
            )}
          </div>
        ),
      },
    ];
  }, [canManage, columns, entityName, remove, rowActions, rowLabel]);

  const editingRow = editing?.row ?? null;

  return (
    <>
      <DataTable
        columns={allColumns}
        data={rows}
        searchPlaceholder={`Tìm ${entityName}…`}
        emptyMessage={`Chưa có ${entityName} nào.`}
        cardTitle={rowLabel}
        toolbar={
          <>
            {toolbarExtra}
            {canManage && importKind && <ImportDialog kind={importKind} title={entityName} />}
            {exportHref && (
              <Button variant="outline" asChild>
                <a href={exportHref} download>
                  <Download aria-hidden />
                  Xuất Excel
                </a>
              </Button>
            )}
            {canManage && (
              <Button onClick={() => setEditing({ row: null })}>
                <Plus aria-hidden />
                Thêm {entityName}
              </Button>
            )}
          </>
        }
        {...tableProps}
      />

      <EntityFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editingRow ? `Sửa ${entityName}: ${rowLabel(editingRow)}` : `Thêm ${entityName}`}
        fields={fields(editingRow)}
        schema={schema(editingRow)}
        defaultValues={toFormValues(editingRow)}
        action={(values) => save(values, editingRow)}
        successMessage={editingRow ? "Đã lưu thay đổi." : `Đã thêm ${entityName}.`}
        onSuccess={() => router.refresh()}
      />

      {remove && deleting && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setDeleting(null)}
          title={`Xoá ${entityName} “${rowLabel(deleting)}”?`}
          description={
            deleteDescription?.(deleting) ?? "Dữ liệu sẽ bị xoá vĩnh viễn và không khôi phục được."
          }
          onConfirm={() => remove(deleting)}
          successMessage={`Đã xoá ${entityName}.`}
          onSuccess={() => router.refresh()}
        />
      )}
    </>
  );
}
