"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { BarChart3, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { StudentTrendChart } from "@/components/catalog/StudentTrendChart";
import { ActiveBadge } from "@/components/common/ActiveBadge";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { CrudTable } from "@/components/common/CrudTable";
import type { FieldConfig } from "@/components/common/EntityForm";
import { EntityFormDialog } from "@/components/common/EntityFormDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { SchoolLevel, SchoolOwnership } from "@/generated/prisma/enums";
import { formatNumber } from "@/lib/format";
import { optionsOf, SCHOOL_LEVEL_LABELS, SCHOOL_OWNERSHIP_LABELS } from "@/lib/i18n/enums";
import { schoolSchema, schoolYearStatSchema } from "@/lib/schemas/catalog";
import {
  deleteSchool,
  deleteSchoolYearStat,
  saveSchool,
  saveSchoolYearStat,
} from "@/server/actions/schools";

export type SchoolStat = {
  id: string;
  schoolId: string;
  schoolYear: string;
  staffTotal: number;
  managers: number | null;
  teachers: number | null;
  employees: number | null;
  classes: number | null;
  students: number;
  femaleStudents: number | null;
  note: string | null;
};

export type SchoolRow = {
  id: string;
  name: string;
  level: SchoolLevel;
  ownership: SchoolOwnership;
  address: string | null;
  phone: string | null;
  email: string | null;
  principal: string | null;
  principalPhone: string | null;
  lat: number | null;
  lng: number | null;
  sortOrder: number;
  active: boolean;
  stat: SchoolStat | null;
};

const num = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : formatNumber(v);

const COLUMNS: ColumnDef<SchoolRow, unknown>[] = [
  { accessorKey: "name", header: "Tên trường", meta: { hideOnCard: true } },
  {
    accessorKey: "level",
    header: "Cấp học",
    cell: ({ row }) => SCHOOL_LEVEL_LABELS[row.original.level],
  },
  {
    accessorKey: "ownership",
    header: "Loại hình",
    cell: ({ row }) => SCHOOL_OWNERSHIP_LABELS[row.original.ownership],
  },
  {
    id: "staff",
    accessorFn: (r) => r.stat?.staffTotal ?? -1,
    header: "CB-GV-NV",
    meta: { align: "right" },
    cell: ({ row }) => num(row.original.stat?.staffTotal),
  },
  {
    id: "classes",
    accessorFn: (r) => r.stat?.classes ?? -1,
    header: "Số lớp",
    meta: { align: "right" },
    cell: ({ row }) => num(row.original.stat?.classes),
  },
  {
    id: "students",
    accessorFn: (r) => r.stat?.students ?? -1,
    header: "Học sinh",
    meta: { align: "right" },
    cell: ({ row }) => num(row.original.stat?.students),
  },
  {
    accessorKey: "active",
    header: "Trạng thái",
    cell: ({ row }) => (
      <ActiveBadge active={row.original.active} on="Đang hoạt động" off="Ngừng hoạt động" />
    ),
  },
];

const LEVEL_OPTIONS = optionsOf(SCHOOL_LEVEL_LABELS);
const OWNERSHIP_OPTIONS = optionsOf(SCHOOL_OWNERSHIP_LABELS);

const SCHOOL_FIELDS: FieldConfig[] = [
  {
    name: "name",
    label: "Tên trường",
    required: true,
    wide: true,
    placeholder: "VD: Trường THCS Thanh Liệt",
  },
  {
    name: "level",
    label: "Cấp học",
    type: "select",
    required: true,
    options: LEVEL_OPTIONS,
    emptyOption: "— Chọn cấp học —",
  },
  {
    name: "ownership",
    label: "Loại hình",
    type: "select",
    required: true,
    options: OWNERSHIP_OPTIONS,
  },
  { name: "address", label: "Địa chỉ", wide: true },
  { name: "phone", label: "Điện thoại", type: "tel" },
  { name: "email", label: "Email", type: "email" },
  { name: "principal", label: "Hiệu trưởng" },
  { name: "principalPhone", label: "SĐT hiệu trưởng", type: "tel" },
  {
    name: "lat",
    label: "Vĩ độ",
    type: "decimal",
    hint: "Tuỳ chọn — dùng cho bản đồ ở giai đoạn sau.",
  },
  { name: "lng", label: "Kinh độ", type: "decimal" },
  { name: "sortOrder", label: "Thứ tự hiển thị", type: "number" },
  { name: "active", label: "Trạng thái", type: "checkbox", placeholder: "Đang hoạt động" },
];

const STAT_FIELDS: FieldConfig[] = [
  { name: "schoolYear", label: "Năm học", required: true, placeholder: "VD: 2026-2027" },
  { name: "staffTotal", label: "Tổng CB-GV-NV", type: "number", required: true },
  { name: "managers", label: "Cán bộ quản lý", type: "number" },
  { name: "teachers", label: "Giáo viên", type: "number" },
  { name: "employees", label: "Nhân viên", type: "number" },
  { name: "classes", label: "Số lớp", type: "number" },
  { name: "students", label: "Số học sinh", type: "number", required: true },
  { name: "femaleStudents", label: "Học sinh nữ", type: "number" },
  { name: "note", label: "Ghi chú", type: "textarea" },
];

const str = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));

type Props = {
  rows: SchoolRow[];
  stats: SchoolStat[];
  schoolYear: string;
  schoolYears: string[];
  canManage: boolean;
  /** Lọc cấp học từ URL (bảng điều hành) */
  initialLevel?: string;
};

export function SchoolsTable({
  rows,
  stats,
  schoolYear,
  schoolYears,
  canManage,
  initialLevel,
}: Props) {
  const router = useRouter();
  const [level, setLevel] = useState(initialLevel ?? "");
  const [ownership, setOwnership] = useState("");
  const [detail, setDetail] = useState<SchoolRow | null>(null);
  const [editingStat, setEditingStat] = useState<{ stat: SchoolStat | null } | null>(null);
  const [deletingStat, setDeletingStat] = useState<SchoolStat | null>(null);

  const shown = useMemo(
    () =>
      rows.filter(
        (r) => (!level || r.level === level) && (!ownership || r.ownership === ownership),
      ),
    [rows, level, ownership],
  );
  const active = shown.filter((r) => r.active);
  const total = (f: (s: SchoolStat) => number | null) =>
    formatNumber(active.reduce((s, r) => s + (r.stat ? (f(r.stat) ?? 0) : 0), 0));
  const detailStats = detail ? stats.filter((s) => s.schoolId === detail.id) : [];

  return (
    <>
      <CrudTable
        entityName="trường học"
        rows={shown}
        columns={COLUMNS}
        canManage={canManage}
        fields={() => SCHOOL_FIELDS}
        schema={() => schoolSchema}
        toFormValues={(r) => ({
          id: r?.id ?? "",
          name: r?.name ?? "",
          level: r?.level ?? "",
          ownership: r?.ownership ?? "CONG_LAP",
          address: r?.address ?? "",
          phone: r?.phone ?? "",
          email: r?.email ?? "",
          principal: r?.principal ?? "",
          principalPhone: r?.principalPhone ?? "",
          lat: str(r?.lat),
          lng: str(r?.lng),
          sortOrder: r
            ? String(r.sortOrder)
            : String(Math.max(0, ...rows.map((x) => x.sortOrder)) + 1),
          active: r?.active ?? true,
        })}
        save={(values) => saveSchool(values as never)}
        remove={(r) => deleteSchool({ id: r.id })}
        deleteDescription={(r) => {
          const n = stats.filter((s) => s.schoolId === r.id).length;
          return `Trường và ${n} bản số liệu năm học sẽ bị xoá vĩnh viễn. Nếu trường chỉ ngừng hoạt động, hãy sửa và bỏ chọn “Đang hoạt động”.`;
        }}
        rowLabel={(r) => r.name}
        searchText={(r) => `${r.name} ${r.principal ?? ""} ${r.address ?? ""}`}
        exportHref={`/api/export/schools?namHoc=${schoolYear}`}
        importKind="schools"
        rowClassName={(r) => (r.active ? undefined : "opacity-60")}
        rowActions={(r) => (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDetail(r)}
            aria-label={`Số liệu các năm học của ${r.name}`}
            title="Số liệu các năm học"
          >
            <BarChart3 aria-hidden />
          </Button>
        )}
        footer={[
          "Tổng (trường đang hoạt động)",
          "",
          "",
          total((s) => s.staffTotal),
          total((s) => s.classes),
          total((s) => s.students),
          "",
          "",
        ]}
        toolbarExtra={
          <>
            <NativeSelect
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              aria-label="Lọc theo cấp học"
            >
              <NativeSelectOption value="">Mọi cấp học</NativeSelectOption>
              {LEVEL_OPTIONS.map((o) => (
                <NativeSelectOption key={o.value} value={o.value}>
                  {o.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <NativeSelect
              value={ownership}
              onChange={(e) => setOwnership(e.target.value)}
              aria-label="Lọc theo loại hình"
            >
              <NativeSelectOption value="">Mọi loại hình</NativeSelectOption>
              {OWNERSHIP_OPTIONS.map((o) => (
                <NativeSelectOption key={o.value} value={o.value}>
                  {o.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <label className="flex items-center gap-2 font-medium">
              Năm học
              <NativeSelect
                value={schoolYear}
                onChange={(e) =>
                  router.push(
                    `/dia-ban/truong-hoc?namHoc=${encodeURIComponent(e.target.value)}` as never,
                  )
                }
                aria-label="Chọn năm học"
              >
                {schoolYears.map((y) => (
                  <NativeSelectOption key={y} value={y}>
                    {y}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </label>
          </>
        }
      />

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl">{detail?.name}</DialogTitle>
            <DialogDescription>
              {detail &&
                `${SCHOOL_LEVEL_LABELS[detail.level]} · ${SCHOOL_OWNERSHIP_LABELS[detail.ownership]}`}
              {detail?.principal && ` · Hiệu trưởng: ${detail.principal}`}
            </DialogDescription>
          </DialogHeader>
          <h3 className="font-semibold">Số học sinh qua các năm học</h3>
          <StudentTrendChart
            data={detailStats.map((s) => ({ schoolYear: s.schoolYear, students: s.students }))}
          />
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Số liệu theo năm học</h3>
            {canManage && (
              <Button onClick={() => setEditingStat({ stat: null })}>
                <Plus aria-hidden />
                Thêm năm học
              </Button>
            )}
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-table">
              <thead className="bg-slate-100">
                <tr>
                  {[
                    "Năm học",
                    "CB-GV-NV",
                    "Quản lý",
                    "Giáo viên",
                    "Nhân viên",
                    "Số lớp",
                    "Học sinh",
                    "HS nữ",
                    ...(canManage ? [""] : []),
                  ].map((h, i) => (
                    <th
                      key={i}
                      scope="col"
                      className={`px-3 py-2 font-semibold whitespace-nowrap ${i === 0 ? "text-left" : "text-right"}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {detailStats.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">
                      Chưa có số liệu năm học nào.
                    </td>
                  </tr>
                )}
                {[...detailStats].reverse().map((s) => (
                  <tr key={s.id} className="border-t">
                    <td className="px-3 py-2 font-medium whitespace-nowrap">{s.schoolYear}</td>
                    {[
                      s.staffTotal,
                      s.managers,
                      s.teachers,
                      s.employees,
                      s.classes,
                      s.students,
                      s.femaleStudents,
                    ].map((v, i) => (
                      <td key={i} className="px-3 py-2 text-right tabular-nums">
                        {num(v)}
                      </td>
                    ))}
                    {canManage && (
                      <td className="px-1 py-1 text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setEditingStat({ stat: s })}
                          aria-label={`Sửa số liệu năm học ${s.schoolYear}`}
                        >
                          <Pencil aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive"
                          onClick={() => setDeletingStat(s)}
                          aria-label={`Xoá số liệu năm học ${s.schoolYear}`}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      {detail && (
        <EntityFormDialog
          open={editingStat !== null}
          onOpenChange={(o) => !o && setEditingStat(null)}
          title={
            editingStat?.stat
              ? `Sửa số liệu năm học ${editingStat.stat.schoolYear}`
              : `Thêm số liệu năm học — ${detail.name}`
          }
          fields={STAT_FIELDS}
          schema={schoolYearStatSchema}
          defaultValues={{
            id: editingStat?.stat?.id ?? "",
            schoolId: detail.id,
            schoolYear: editingStat?.stat?.schoolYear ?? schoolYear,
            staffTotal: str(editingStat?.stat?.staffTotal),
            managers: str(editingStat?.stat?.managers),
            teachers: str(editingStat?.stat?.teachers),
            employees: str(editingStat?.stat?.employees),
            classes: str(editingStat?.stat?.classes),
            students: str(editingStat?.stat?.students),
            femaleStudents: str(editingStat?.stat?.femaleStudents),
            note: editingStat?.stat?.note ?? "",
          }}
          action={(v) => saveSchoolYearStat(v as never)}
          onSuccess={() => router.refresh()}
        />
      )}

      {deletingStat && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setDeletingStat(null)}
          title={`Xoá số liệu năm học ${deletingStat.schoolYear}?`}
          description="Số liệu năm học này sẽ bị xoá vĩnh viễn."
          onConfirm={() => deleteSchoolYearStat({ id: deletingStat.id })}
          successMessage="Đã xoá số liệu năm học."
          onSuccess={() => router.refresh()}
        />
      )}
    </>
  );
}
