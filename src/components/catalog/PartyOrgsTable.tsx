"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { ActiveBadge } from "@/components/common/ActiveBadge";
import { CrudTable } from "@/components/common/CrudTable";
import type { FieldConfig, Option } from "@/components/common/EntityForm";
import { EntityFormDialog } from "@/components/common/EntityFormDialog";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { PartyBlock, PartyOrgType } from "@/generated/prisma/enums";
import { formatNumber } from "@/lib/format";
import {
  optionsOf,
  PARTY_BLOCK_LABELS,
  PARTY_ORG_TYPE_LABELS,
  PARTY_RATING_OPTIONS,
} from "@/lib/i18n/enums";
import { partyOrgSchema, partyOverrideSchema } from "@/lib/schemas/catalog";
import { deletePartyOrg, savePartyOrg } from "@/server/actions/party-orgs";
import { updatePartyOverrides } from "@/server/actions/ward";

export type PartyOrgRow = {
  id: string;
  depth: number;
  name: string;
  type: PartyOrgType;
  block: PartyBlock;
  parentId: string | null;
  secretary: string | null;
  secretaryPhone: string | null;
  deputySecretary: string | null;
  memberCount: number;
  officialMembers: number | null;
  probationaryMembers: number | null;
  latestRating: string | null;
  ratingYear: number | null;
  residentialId: string | null;
  schoolId: string | null;
  sortOrder: number;
  active: boolean;
  childCount: number;
};

export type PartyOverrides = {
  partyOrgCountOverride: number | null;
  partyCellCountOverride: number | null;
  partyMemberCountOverride: number | null;
};

const COLUMNS: ColumnDef<PartyOrgRow, unknown>[] = [
  {
    accessorKey: "name",
    header: "Tên tổ chức",
    meta: { hideOnCard: true },
    cell: ({ row }) => (
      <span
        style={{ paddingLeft: `${row.original.depth * 1.5}rem` }}
        className={
          row.original.depth === 0
            ? "font-bold"
            : row.original.childCount > 0
              ? "font-semibold"
              : undefined
        }
      >
        {row.original.depth > 0 && (
          <span className="mr-1 text-muted-foreground" aria-hidden>
            └
          </span>
        )}
        {row.original.name}
      </span>
    ),
  },
  {
    accessorKey: "type",
    header: "Loại",
    cell: ({ row }) => PARTY_ORG_TYPE_LABELS[row.original.type],
  },
  {
    accessorKey: "block",
    header: "Khối",
    cell: ({ row }) => PARTY_BLOCK_LABELS[row.original.block],
  },
  {
    accessorKey: "secretary",
    header: "Bí thư",
    cell: ({ getValue }) => (getValue() as string | null) ?? "—",
  },
  {
    accessorKey: "memberCount",
    header: "Đảng viên",
    meta: { align: "right" },
    cell: ({ getValue }) => formatNumber(getValue() as number),
  },
  {
    accessorKey: "latestRating",
    header: "Xếp loại gần nhất",
    cell: ({ row }) =>
      row.original.latestRating
        ? `${row.original.latestRating}${row.original.ratingYear ? ` (${row.original.ratingYear})` : ""}`
        : "—",
  },
  {
    accessorKey: "active",
    header: "Trạng thái",
    cell: ({ row }) => (
      <ActiveBadge active={row.original.active} on="Đang hoạt động" off="Ngừng hoạt động" />
    ),
  },
];

const str = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));

type Props = {
  rows: PartyOrgRow[];
  canManage: boolean;
  canOverride: boolean;
  overrides: PartyOverrides;
  parents: Option[];
  residentials: Option[];
  schools: Option[];
  /** Lọc sẵn từ URL (bảng điều hành): loai=chi-bo | <PartyOrgType>, khoi=<PartyBlock> */
  initial?: { type?: string; block?: string; query?: string };
};

const CELL_TYPES_SET = new Set(["CHI_BO_CO_SO", "CHI_BO_TRUC_THUOC"]);

export function PartyOrgsTable({
  rows,
  canManage,
  canOverride,
  overrides,
  parents,
  residentials,
  schools,
  initial,
}: Props) {
  const router = useRouter();
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState(
    initial?.type === "chi-bo" ? "CHI_BO" : (initial?.type ?? ""),
  );
  const [blockFilter, setBlockFilter] = useState(initial?.block ?? "");
  const shown = useMemo(
    () =>
      rows.filter(
        (r) =>
          (!typeFilter ||
            (typeFilter === "CHI_BO" ? CELL_TYPES_SET.has(r.type) : r.type === typeFilter)) &&
          (!blockFilter || r.block === blockFilter),
      ),
    [rows, typeFilter, blockFilter],
  );

  const fields = (row: PartyOrgRow | null): FieldConfig[] => [
    {
      name: "name",
      label: "Tên tổ chức",
      required: true,
      wide: true,
      placeholder: "VD: Chi bộ Tổ dân phố số 5",
    },
    {
      name: "type",
      label: "Loại tổ chức",
      type: "select",
      required: true,
      options: optionsOf(PARTY_ORG_TYPE_LABELS),
      emptyOption: "— Chọn loại —",
    },
    {
      name: "block",
      label: "Khối",
      type: "select",
      required: true,
      options: optionsOf(PARTY_BLOCK_LABELS),
    },
    {
      name: "parentId",
      label: "Cấp trên trực tiếp",
      type: "select",
      options: parents.filter((p) => p.value !== row?.id),
      hint: "Chi bộ cơ sở, đảng bộ bộ phận/cơ sở → Đảng bộ phường. Chi bộ trực thuộc → đảng bộ bộ phận/cơ sở.",
    },
    { name: "secretary", label: "Bí thư" },
    { name: "secretaryPhone", label: "SĐT bí thư", type: "tel" },
    { name: "deputySecretary", label: "Phó Bí thư" },
    { name: "memberCount", label: "Tổng số đảng viên", type: "number", required: true },
    { name: "officialMembers", label: "Đảng viên chính thức", type: "number" },
    { name: "probationaryMembers", label: "Đảng viên dự bị", type: "number" },
    {
      name: "latestRating",
      label: "Xếp loại năm gần nhất",
      type: "select",
      options: PARTY_RATING_OPTIONS.map((v) => ({ value: v, label: v })),
    },
    { name: "ratingYear", label: "Năm xếp loại", type: "number" },
    { name: "residentialId", label: "Tổ dân phố liên kết", type: "select", options: residentials },
    { name: "schoolId", label: "Trường học liên kết", type: "select", options: schools },
    { name: "sortOrder", label: "Thứ tự hiển thị", type: "number" },
    { name: "active", label: "Trạng thái", type: "checkbox", placeholder: "Đang hoạt động" },
  ];

  const rootId = rows.find((r) => r.type === "DANG_BO_PHUONG")?.id ?? "";

  return (
    <>
      <CrudTable
        entityName="tổ chức đảng"
        initialQuery={initial?.query}
        rows={shown}
        columns={COLUMNS}
        canManage={canManage}
        fields={fields}
        schema={() => partyOrgSchema}
        toFormValues={(r) => ({
          id: r?.id ?? "",
          name: r?.name ?? "",
          type: r?.type ?? "CHI_BO_CO_SO",
          block: r?.block ?? "KHU_DAN_CU",
          parentId: r ? (r.parentId ?? "") : rootId,
          secretary: r?.secretary ?? "",
          secretaryPhone: r?.secretaryPhone ?? "",
          deputySecretary: r?.deputySecretary ?? "",
          memberCount: str(r?.memberCount ?? 0),
          officialMembers: str(r?.officialMembers),
          probationaryMembers: str(r?.probationaryMembers),
          latestRating: r?.latestRating ?? "",
          ratingYear: str(r?.ratingYear),
          residentialId: r?.residentialId ?? "",
          schoolId: r?.schoolId ?? "",
          sortOrder: str(r?.sortOrder ?? 0),
          active: r?.active ?? true,
        })}
        save={(values) => savePartyOrg(values as never)}
        remove={(r) => deletePartyOrg({ id: r.id })}
        deleteDescription={(r) =>
          r.childCount > 0
            ? `Tổ chức đang có ${r.childCount} tổ chức trực thuộc nên không xoá được. Hãy chuyển hoặc xoá các tổ chức đó trước.`
            : "Tổ chức sẽ bị xoá vĩnh viễn. Nếu chỉ giải thể/sáp nhập, nên bỏ chọn “Đang hoạt động” để giữ lịch sử."
        }
        rowLabel={(r) => r.name}
        searchText={(r) => `${r.name} ${r.secretary ?? ""} ${PARTY_BLOCK_LABELS[r.block]}`}
        exportHref="/api/export/party-orgs"
        importKind="party-orgs"
        paginate={false}
        enableSorting={false}
        rowClassName={(r) => (r.active ? undefined : "opacity-60")}
        toolbarExtra={
          <>
            <NativeSelect
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              aria-label="Lọc theo loại tổ chức"
              className="max-w-56"
            >
              <NativeSelectOption value="">Mọi loại tổ chức</NativeSelectOption>
              <NativeSelectOption value="CHI_BO">Chi bộ (cơ sở + trực thuộc)</NativeSelectOption>
              {optionsOf(PARTY_ORG_TYPE_LABELS).map((o) => (
                <NativeSelectOption key={o.value} value={o.value}>
                  {o.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <NativeSelect
              value={blockFilter}
              onChange={(e) => setBlockFilter(e.target.value)}
              aria-label="Lọc theo khối"
              className="max-w-56"
            >
              <NativeSelectOption value="">Mọi khối</NativeSelectOption>
              {optionsOf(PARTY_BLOCK_LABELS).map((o) => (
                <NativeSelectOption key={o.value} value={o.value}>
                  {o.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            {canOverride && (
              <Button variant="outline" onClick={() => setOverrideOpen(true)}>
                <SlidersHorizontal aria-hidden />
                Số liệu tổng hợp thủ công
              </Button>
            )}
          </>
        }
      />
      <EntityFormDialog
        open={overrideOpen}
        onOpenChange={setOverrideOpen}
        title="Số liệu tổng hợp thủ công"
        description="Dùng khi danh mục chưa nhập đủ: bảng điều hành sẽ hiển thị số nhập tay. Để trống ô nào thì ô đó dùng số đếm thực từ danh mục."
        fields={[
          { name: "partyOrgCountOverride", label: "Số tổ chức đảng trực thuộc", type: "number" },
          { name: "partyCellCountOverride", label: "Số chi bộ", type: "number" },
          { name: "partyMemberCountOverride", label: "Tổng số đảng viên", type: "number" },
        ]}
        schema={partyOverrideSchema}
        defaultValues={{
          partyOrgCountOverride: str(overrides.partyOrgCountOverride),
          partyCellCountOverride: str(overrides.partyCellCountOverride),
          partyMemberCountOverride: str(overrides.partyMemberCountOverride),
        }}
        action={(v) => updatePartyOverrides(v as never)}
        onSuccess={() => router.refresh()}
      />
    </>
  );
}
