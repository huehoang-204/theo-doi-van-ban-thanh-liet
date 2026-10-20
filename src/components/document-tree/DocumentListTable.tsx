"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Download, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/common/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { VALIDITY_LABELS } from "@/lib/schemas/document";
import { cn } from "@/lib/utils";
import { restoreDocument } from "@/server/actions/documents";

import { useTree } from "./TreeContext";

export type DocumentListRow = {
  id: string;
  depth: number;
  rootId: string | null;
  programTitle: string;
  typeId: string;
  typeName: string;
  typeColor: string;
  number: string | null;
  title: string;
  agency: string | null;
  issuedDate: string;
  issuedSort: string;
  fieldId: string | null;
  fieldName: string | null;
  validity: keyof typeof VALIDITY_LABELS;
  deletedAt: string | null;
  canRestore: boolean;
};

const BASE_COLUMNS: ColumnDef<DocumentListRow, unknown>[] = [
  { accessorKey: "depth", header: "Cấp", meta: { align: "center", className: "w-16" } },
  {
    accessorKey: "typeName",
    header: "Loại",
    cell: ({ row }) => (
      <Badge style={{ backgroundColor: row.original.typeColor }} className="text-white">
        {row.original.typeName}
      </Badge>
    ),
  },
  {
    accessorKey: "number",
    header: "Số, ký hiệu",
    cell: ({ getValue }) => <strong>{(getValue() as string | null) ?? "—"}</strong>,
  },
  {
    accessorKey: "title",
    header: "Trích yếu",
    meta: { hideOnCard: true },
    cell: ({ row }) =>
      row.original.deletedAt ? (
        row.original.title
      ) : (
        <Link
          href={`/van-ban/${row.original.id}`}
          className="text-brand underline-offset-4 hover:underline"
        >
          {row.original.title}
        </Link>
      ),
  },
  { accessorKey: "programTitle", header: "Chương trình" },
  {
    accessorKey: "agency",
    header: "Cơ quan ban hành",
    cell: ({ getValue }) => (getValue() as string | null) ?? "—",
  },
  {
    id: "issued",
    accessorFn: (r) => r.issuedSort,
    header: "Ngày ban hành",
    cell: ({ row }) => row.original.issuedDate || "—",
  },
  {
    accessorKey: "fieldName",
    header: "Lĩnh vực",
    cell: ({ getValue }) => (getValue() as string | null) ?? "—",
  },
  {
    accessorKey: "validity",
    header: "Trạng thái",
    cell: ({ row }) => VALIDITY_LABELS[row.original.validity],
  },
];

type Props = {
  rows: DocumentListRow[];
  deletedRows: DocumentListRow[];
  programs: { id: string; title: string }[];
};

/** Dạng danh sách (Mục 4.4): bảng phẳng có cột Cấp, lọc, xuất Excel; mục "Đã xoá" để khôi phục */
export function DocumentListTable({ rows, deletedRows, programs }: Props) {
  const tree = useTree();
  const router = useRouter();
  const [program, setProgram] = useState("");
  const [typeId, setTypeId] = useState("");
  const [fieldId, setFieldId] = useState("");
  const [validity, setValidity] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);

  const source = showDeleted ? deletedRows : rows;
  const shown = useMemo(
    () =>
      source.filter(
        (r) =>
          (!program || r.id === program || r.rootId === program) &&
          (!typeId || r.typeId === typeId) &&
          (!fieldId || r.fieldId === fieldId) &&
          (!validity || r.validity === validity),
      ),
    [source, program, typeId, fieldId, validity],
  );

  const columns = useMemo<ColumnDef<DocumentListRow, unknown>[]>(
    () =>
      showDeleted
        ? [
            ...BASE_COLUMNS,
            { accessorKey: "deletedAt", header: "Ngày xoá" },
            {
              id: "restore",
              header: "",
              enableSorting: false,
              meta: { label: "" },
              cell: ({ row }) =>
                row.original.canRestore && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const r = await restoreDocument({ id: row.original.id });
                      if (!r.ok) return void toast.error(r.error.message);
                      toast.success(`Đã khôi phục ${r.data.count} văn bản.`);
                      await tree.refresh([r.data.parentId]);
                      router.refresh();
                    }}
                  >
                    <RotateCcw aria-hidden />
                    Khôi phục
                  </Button>
                ),
            },
          ]
        : BASE_COLUMNS,
    [showDeleted, tree, router],
  );

  const exportHref = `/api/export/documents${program ? `?goc=${encodeURIComponent(program)}` : ""}`;
  const select = (
    label: string,
    value: string,
    set: (v: string) => void,
    options: { value: string; label: string }[],
    all: string,
  ) => (
    <NativeSelect
      value={value}
      onChange={(e) => set(e.target.value)}
      aria-label={label}
      className="max-w-64"
    >
      <NativeSelectOption value="">{all}</NativeSelectOption>
      {options.map((o) => (
        <NativeSelectOption key={o.value} value={o.value}>
          {o.label}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="inline-flex w-fit rounded-lg bg-muted p-1">
        {[
          [false, `Đang có (${rows.length})`],
          [true, `Đã xoá — Thùng rác 30 ngày (${deletedRows.length})`],
        ].map(([deleted, text]) => (
          <button
            key={String(deleted)}
            type="button"
            onClick={() => setShowDeleted(deleted as boolean)}
            aria-pressed={showDeleted === deleted}
            className={cn(
              "h-10 rounded-md px-3 font-medium",
              showDeleted === deleted ? "bg-card text-brand shadow-sm" : "text-muted-foreground",
            )}
          >
            {text as string}
          </button>
        ))}
      </div>
      <DataTable
        columns={columns}
        data={shown}
        searchText={(r) => `${r.number ?? ""} ${r.typeName} ${r.title} ${r.agency ?? ""}`}
        searchPlaceholder="Tìm trong danh sách…"
        emptyMessage={showDeleted ? "Thùng rác trống." : "Chưa có văn bản nào."}
        cardTitle={(r) => (r.number ? `${r.number} – ${r.title}` : r.title)}
        rowClassName={(r) => (r.depth === 1 ? "font-semibold" : undefined)}
        toolbar={
          <>
            {select(
              "Lọc theo chương trình",
              program,
              setProgram,
              programs.map((p) => ({ value: p.id, label: p.title })),
              "Mọi chương trình",
            )}
            {select(
              "Lọc theo loại văn bản",
              typeId,
              setTypeId,
              tree.options.types.map((t) => ({ value: t.id, label: t.name })),
              "Mọi loại",
            )}
            {select("Lọc theo lĩnh vực", fieldId, setFieldId, tree.options.fields, "Mọi lĩnh vực")}
            {select(
              "Lọc theo trạng thái",
              validity,
              setValidity,
              Object.entries(VALIDITY_LABELS).map(([value, label]) => ({ value, label })),
              "Mọi trạng thái",
            )}
            {!showDeleted && (
              <Button variant="outline" asChild>
                <a href={exportHref} download>
                  <Download aria-hidden />
                  Xuất Excel cây
                </a>
              </Button>
            )}
          </>
        }
      />
    </div>
  );
}
