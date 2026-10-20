"use client";

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type Row,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { formatNumber } from "@/lib/format";
import { normalizeForSearch } from "@/lib/text";
import { cn } from "@/lib/utils";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    /** Nhãn cột (dùng cho dạng thẻ trên điện thoại) */
    label?: string;
    align?: "left" | "right" | "center";
    /** Ẩn trên dạng thẻ điện thoại */
    hideOnCard?: boolean;
    className?: string;
  }
}

const PAGE_SIZES = [20, 50, 100] as const;

type DataTableProps<T> = {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  /** Chuỗi để tìm không dấu trên mỗi dòng */
  searchText?: (row: T) => string;
  searchPlaceholder?: string;
  /** Bộ lọc & nút bên phải ô tìm kiếm */
  toolbar?: React.ReactNode;
  /** Dòng tổng cuối bảng — một ô cho mỗi cột */
  footer?: React.ReactNode[];
  emptyMessage?: string;
  enableSorting?: boolean;
  /** Tắt phân trang (VD cây tổ chức đảng cần hiển thị liền mạch) */
  paginate?: boolean;
  /** Tiêu đề thẻ trên điện thoại */
  cardTitle?: (row: T) => React.ReactNode;
  rowClassName?: (row: T) => string | undefined;
};

/**
 * Bảng dữ liệu (Mục 8.2.14–15): tiêu đề cố định khi cuộn, sắp xếp cột, tìm không dấu,
 * phân trang 20/50/100; dưới 768px chuyển thành dạng thẻ.
 */
export function DataTable<T>({
  columns,
  data,
  searchText,
  searchPlaceholder = "Tìm kiếm…",
  toolbar,
  footer,
  emptyMessage = "Không có dữ liệu.",
  enableSorting = true,
  paginate = true,
  cardTitle,
  rowClassName,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [query, setQuery] = useState("");
  const searchIndex = useMemo(
    () =>
      searchText ? new Map(data.map((row) => [row, normalizeForSearch(searchText(row))])) : null,
    [data, searchText],
  );

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table v8 chưa tương thích React Compiler
  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter: query },
    onSortingChange: setSorting,
    onGlobalFilterChange: setQuery,
    enableSorting,
    globalFilterFn: (row: Row<T>, _columnId, value: string) => {
      const q = normalizeForSearch(value);
      return !q || (searchIndex?.get(row.original) ?? "").includes(q);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    ...(paginate ? { getPaginationRowModel: getPaginationRowModel() } : {}),
    initialState: { pagination: { pageSize: 20 } },
    autoResetPageIndex: true,
  });

  const rows = table.getRowModel().rows;
  const filteredCount = table.getFilteredRowModel().rows.length;
  const { pageIndex, pageSize } = table.getState().pagination;
  const pageCount = Math.max(1, table.getPageCount());

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        {searchText && (
          <div className="relative w-full lg:max-w-sm">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="pl-10"
            />
          </div>
        )}
        {toolbar && (
          <div className="flex flex-1 flex-wrap items-center gap-2 lg:justify-end">{toolbar}</div>
        )}
      </div>

      {/* Màn ≥ 768px: bảng */}
      <div className="hidden max-h-[70dvh] overflow-auto rounded-xl border bg-card shadow-sm md:block">
        <table className="w-full border-collapse text-table">
          <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => {
                  const meta = header.column.columnDef.meta;
                  const sorted = header.column.getIsSorted();
                  const canSort = header.column.getCanSort();
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={
                        sorted === "asc"
                          ? "ascending"
                          : sorted === "desc"
                            ? "descending"
                            : undefined
                      }
                      className={cn(
                        "border-b px-3 py-3 text-left font-semibold whitespace-nowrap text-slate-700 dark:text-slate-200",
                        meta?.align === "right" && "text-right",
                        meta?.align === "center" && "text-center",
                        meta?.className,
                      )}
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className={cn(
                            "inline-flex items-center gap-1 rounded hover:text-brand",
                            meta?.align === "right" && "flex-row-reverse",
                          )}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === "asc" ? (
                            <ArrowUp className="size-4" aria-hidden />
                          ) : sorted === "desc" ? (
                            <ArrowDown className="size-4" aria-hidden />
                          ) : (
                            <ArrowUpDown className="size-4 opacity-40" aria-hidden />
                          )}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-10 text-center text-muted-foreground"
                >
                  {query ? "Không tìm thấy kết quả phù hợp." : emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    "border-b last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-800/50",
                    rowClassName?.(row.original),
                  )}
                >
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta;
                    return (
                      <td
                        key={cell.id}
                        className={cn(
                          "px-3 py-2.5 align-middle",
                          meta?.align === "right" && "text-right tabular-nums",
                          meta?.align === "center" && "text-center",
                          meta?.className,
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
          {footer && rows.length > 0 && (
            <tfoot className="sticky bottom-0 bg-brand-soft font-semibold">
              <tr>
                {footer.map((cell, i) => (
                  <td
                    key={i}
                    className={cn(
                      "px-3 py-3",
                      table.getAllLeafColumns()[i]?.columnDef.meta?.align === "right" &&
                        "text-right tabular-nums",
                    )}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Màn < 768px: thẻ */}
      <ul className="flex flex-col gap-3 md:hidden">
        {rows.length === 0 && (
          <li className="rounded-xl border bg-card p-6 text-center text-muted-foreground">
            {query ? "Không tìm thấy kết quả phù hợp." : emptyMessage}
          </li>
        )}
        {rows.map((row) => (
          <li
            key={row.id}
            className={cn("rounded-xl border bg-card p-4 shadow-sm", rowClassName?.(row.original))}
          >
            {cardTitle && (
              <div className="mb-2 text-lg font-semibold">{cardTitle(row.original)}</div>
            )}
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
              {row.getVisibleCells().map((cell) => {
                const meta = cell.column.columnDef.meta;
                if (meta?.hideOnCard) return null;
                const label =
                  meta?.label ??
                  (typeof cell.column.columnDef.header === "string"
                    ? cell.column.columnDef.header
                    : "");
                return label ? (
                  <div key={cell.id} className="contents">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="min-w-0 break-words">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </dd>
                  </div>
                ) : (
                  <div key={cell.id} className="col-span-2 pt-1">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </div>
                );
              })}
            </dl>
          </li>
        ))}
        {footer && rows.length > 0 && (
          <li className="rounded-xl bg-brand-soft p-4 font-semibold">
            {footer
              .filter((c) => c !== null && c !== "" && c !== undefined)
              .map((c, i) => (
                <span key={i} className="mr-3 inline-block">
                  {c}
                </span>
              ))}
          </li>
        )}
      </ul>

      <div className="flex flex-col gap-3 text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>
          {query
            ? `${formatNumber(filteredCount)} / ${formatNumber(data.length)} dòng`
            : `${formatNumber(data.length)} dòng`}
        </span>
        {paginate && filteredCount > PAGE_SIZES[0] && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2">
              <span>Hiển thị</span>
              <NativeSelect
                value={String(pageSize)}
                onChange={(e) => table.setPageSize(Number(e.target.value))}
                size="sm"
                aria-label="Số dòng mỗi trang"
              >
                {PAGE_SIZES.map((s) => (
                  <NativeSelectOption key={s} value={s}>
                    {s}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </label>
            <span className="tabular-nums">
              Trang {pageIndex + 1}/{pageCount}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label="Trang trước"
            >
              <ChevronLeft aria-hidden />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              aria-label="Trang sau"
            >
              <ChevronRight aria-hidden />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
