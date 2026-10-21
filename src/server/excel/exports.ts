import "server-only";

import type { Role } from "@/generated/prisma/enums";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  PARTY_BLOCK_LABELS,
  PARTY_ORG_TYPE_LABELS,
  SCHOOL_LEVEL_LABELS,
  SCHOOL_OWNERSHIP_LABELS,
} from "@/lib/i18n/enums";
import type { Action } from "@/lib/permissions";
import type { CurrentUser } from "@/server/auth/current-user";
import { listDocumentsFlat } from "@/server/documents/queries";
import { flattenTree } from "@/lib/party";
import { URGENCY_LABELS, VALIDITY_LABELS } from "@/lib/schemas/document";
import { PRIORITY_LABELS } from "@/lib/schemas/task";
import { FLOW_LABELS, statusLabel } from "@/lib/status";
import { listPeriods } from "@/server/reports/queries";
import { listTasks } from "@/server/tasks/queries";
import { ROLE_LABELS } from "@/lib/permissions";
import {
  getCurrentSchoolYear,
  listDepartments,
  listDocumentTypes,
  listFields,
  listIssuingAgencies,
  listOldAreas,
  listPartyOrgsTree,
  listResidentials,
  listSchools,
  listUsers,
  normalizeSchoolYear,
} from "@/server/queries/catalog";
import { buildExportWorkbook, type ExportColumn } from "@/server/excel/workbook";

type ExportDef = {
  permission: Action;
  fileName: (params: URLSearchParams) => Promise<string> | string;
  build: (params: URLSearchParams, user: CurrentUser) => Promise<Buffer>;
};

const yesNo = (v: boolean) => (v ? "Có" : "Không");
const activeLabel = (v: boolean) => (v ? "Đang sử dụng" : "Ngừng sử dụng");

function define<T>(
  sheet: string,
  load: (params: URLSearchParams) => Promise<T[]>,
  columns: ExportColumn<T>[],
  footer?: (rows: T[]) => (string | number | null)[],
) {
  return async (params: URLSearchParams) => {
    const rows = await load(params);
    return buildExportWorkbook(sheet, columns, rows, footer?.(rows));
  };
}

const sum = <T>(rows: T[], f: (r: T) => number | null | undefined) =>
  rows.reduce((s, r) => s + (f(r) ?? 0), 0);

export const EXPORTS: Record<string, ExportDef> = {
  schools: {
    permission: "school.view",
    fileName: async (p) =>
      `Truong-hoc_${normalizeSchoolYear(p.get("namHoc") ?? undefined, await getCurrentSchoolYear())}.xlsx`,
    build: async (p) => {
      const year = normalizeSchoolYear(p.get("namHoc") ?? undefined, await getCurrentSchoolYear());
      return define(
        `Truong hoc ${year}`,
        () => listSchools(year),
        [
          { header: "Tên trường", value: (s) => s.name, width: 36 },
          { header: "Cấp học", value: (s) => SCHOOL_LEVEL_LABELS[s.level], width: 12 },
          { header: "Loại hình", value: (s) => SCHOOL_OWNERSHIP_LABELS[s.ownership], width: 12 },
          { header: "Năm học", value: () => year, width: 11 },
          { header: "Tổng CB-GV-NV", value: (s) => s.stat?.staffTotal, format: "int", width: 14 },
          { header: "Cán bộ quản lý", value: (s) => s.stat?.managers, format: "int", width: 12 },
          { header: "Giáo viên", value: (s) => s.stat?.teachers, format: "int", width: 11 },
          { header: "Nhân viên", value: (s) => s.stat?.employees, format: "int", width: 11 },
          { header: "Số lớp", value: (s) => s.stat?.classes, format: "int", width: 9 },
          { header: "Số học sinh", value: (s) => s.stat?.students, format: "int", width: 12 },
          { header: "Học sinh nữ", value: (s) => s.stat?.femaleStudents, format: "int", width: 12 },
          { header: "Địa chỉ", value: (s) => s.address, width: 30 },
          { header: "Điện thoại", value: (s) => s.phone, width: 14 },
          { header: "Email", value: (s) => s.email, width: 24 },
          { header: "Hiệu trưởng", value: (s) => s.principal, width: 22 },
          { header: "SĐT hiệu trưởng", value: (s) => s.principalPhone, width: 15 },
          {
            header: "Trạng thái",
            value: (s) => (s.active ? "Đang hoạt động" : "Ngừng hoạt động"),
            width: 16,
          },
        ],
        (rows) => {
          const active = rows.filter((r) => r.active);
          return [
            "Tổng cộng",
            "",
            "",
            "",
            sum(active, (r) => r.stat?.staffTotal),
            sum(active, (r) => r.stat?.managers),
            sum(active, (r) => r.stat?.teachers),
            sum(active, (r) => r.stat?.employees),
            sum(active, (r) => r.stat?.classes),
            sum(active, (r) => r.stat?.students),
            sum(active, (r) => r.stat?.femaleStudents),
          ];
        },
      )(p);
    },
  },
  residentials: {
    permission: "residential.view",
    fileName: () => "To-dan-pho.xlsx",
    build: define(
      "To dan pho",
      () => listResidentials(),
      [
        { header: "Số thứ tự", value: (r) => r.code, width: 10 },
        { header: "Tên TDP", value: (r) => r.name, width: 26 },
        { header: "Khu vực cũ", value: (r) => r.oldArea?.name, width: 18 },
        { header: "Tổ trưởng", value: (r) => r.leaderName, width: 22 },
        { header: "SĐT tổ trưởng", value: (r) => r.leaderPhone, width: 15 },
        { header: "Số hộ", value: (r) => r.households, format: "int", width: 10 },
        { header: "Số nhân khẩu", value: (r) => r.population, format: "int", width: 13 },
        { header: "Chi bộ phụ trách", value: (r) => r.partyOrg?.name, width: 30 },
        { header: "Ghi chú", value: (r) => r.note, width: 30 },
        { header: "Trạng thái", value: (r) => activeLabel(r.active), width: 15 },
      ],
      (rows) => {
        const active = rows.filter((r) => r.active);
        return [
          "",
          `Tổng: ${active.length} TDP`,
          "",
          "",
          "",
          sum(active, (r) => r.households),
          sum(active, (r) => r.population),
        ];
      },
    ),
  },
  "party-orgs": {
    permission: "partyOrg.view",
    fileName: () => "To-chuc-dang.xlsx",
    build: define("To chuc dang", () => listPartyOrgsTree(), [
      { header: "Tên tổ chức", value: (o) => `${"    ".repeat(o.treeDepth)}${o.name}`, width: 40 },
      { header: "Loại", value: (o) => PARTY_ORG_TYPE_LABELS[o.type], width: 18 },
      { header: "Khối", value: (o) => PARTY_BLOCK_LABELS[o.block], width: 18 },
      { header: "Cấp trên trực tiếp", value: (o) => o.parent?.name, width: 30 },
      { header: "Bí thư", value: (o) => o.secretary, width: 22 },
      { header: "SĐT bí thư", value: (o) => o.secretaryPhone, width: 14 },
      { header: "Phó Bí thư", value: (o) => o.deputySecretary, width: 22 },
      { header: "Số đảng viên", value: (o) => o.memberCount, format: "int", width: 12 },
      { header: "Chính thức", value: (o) => o.officialMembers, format: "int", width: 11 },
      { header: "Dự bị", value: (o) => o.probationaryMembers, format: "int", width: 9 },
      { header: "Xếp loại năm gần nhất", value: (o) => o.latestRating, width: 26 },
      { header: "Năm xếp loại", value: (o) => o.ratingYear, width: 12 },
      { header: "TDP liên kết", value: (o) => o.residential?.name, width: 22 },
      { header: "Trường liên kết", value: (o) => o.school?.name, width: 26 },
      {
        header: "Trạng thái",
        value: (o) => (o.active ? "Đang hoạt động" : "Ngừng hoạt động"),
        width: 16,
      },
    ]),
  },
  documents: {
    permission: "document.list",
    fileName: (p) => (p.get("goc") ? "Cay-van-ban_chuong-trinh.xlsx" : "Cay-van-ban.xlsx"),
    build: async (p, user) => {
      const rows = await listDocumentsFlat(user, { rootId: p.get("goc") });
      // Thứ tự cây (cha trước con, anh em theo thứ tự thủ công); nút mà tổ tiên bị ẩn do phạm vi xem → nổi lên cấp ngoài
      const ordered = flattenTree(
        rows,
        (a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, "vi"),
      );
      return buildExportWorkbook(
        "Cay van ban",
        [
          { header: "Cấp", value: (d) => d.depth, width: 6 },
          { header: "Loại", value: (d) => d.type.name, width: 14 },
          { header: "Số, ký hiệu", value: (d) => d.number, width: 18 },
          {
            header: "Trích yếu (thụt lề theo cấp)",
            value: (d) => d.title,
            width: 70,
            indent: (d) => d.depth - 1,
          },
          {
            header: "Cơ quan ban hành",
            value: (d) => d.issuingAgency?.name ?? d.issuingAgencyText,
            width: 28,
          },
          { header: "Ngày ban hành", value: (d) => formatDate(d.issuedDate), width: 14 },
          { header: "Lĩnh vực", value: (d) => d.field?.name, width: 18 },
          { header: "Đơn vị chủ trì", value: (d) => d.leadDepartment?.name, width: 28 },
          { header: "Độ khẩn", value: (d) => URGENCY_LABELS[d.urgency], width: 12 },
          { header: "Hạn xử lý", value: (d) => formatDate(d.dueDate), width: 12 },
          { header: "Trạng thái", value: (d) => VALIDITY_LABELS[d.validity], width: 14 },
          { header: "Số tệp", value: (d) => d._count.attachments, format: "int", width: 8 },
        ],
        ordered,
      );
    },
  },
  tasks: {
    permission: "task.list",
    fileName: () => "Cong-viec.xlsx",
    build: async (_p, user) => {
      const rows = await listTasks(user);
      return buildExportWorkbook(
        "Cong viec",
        [
          { header: "Công việc", value: (t) => t.title, width: 48 },
          {
            header: "Văn bản nguồn",
            value: (t) => (t.document ? (t.document.number ?? t.document.title) : "Phát sinh"),
            width: 24,
          },
          { header: "Chủ trì", value: (t) => t.lead, width: 30 },
          { header: "Người giao", value: (t) => t.assigner, width: 22 },
          { header: "Hạn", value: (t) => formatDate(t.dueDate), width: 12 },
          {
            header: "Trạng thái",
            value: (t) => (t.status ? statusLabel(t.status) : "Đã huỷ"),
            width: 20,
          },
          { header: "Bước xử lý", value: (t) => FLOW_LABELS[t.flow], width: 22 },
          { header: "Tiến độ (%)", value: (t) => t.progress, format: "int", width: 11 },
          { header: "Ưu tiên", value: (t) => PRIORITY_LABELS[t.priority], width: 12 },
        ],
        rows,
      );
    },
  },
  reports: {
    permission: "report.list",
    fileName: () => "Theo-doi-bao-cao.xlsx",
    build: async (_p, user) => {
      const rows = await listPeriods(user);
      return buildExportWorkbook(
        "Bao cao",
        [
          { header: "Báo cáo", value: (r) => r.requirement.name, width: 44 },
          {
            header: "Văn bản yêu cầu",
            value: (r) => r.requirement.document.number ?? r.requirement.document.title,
            width: 22,
          },
          { header: "Kỳ", value: (r) => r.label, width: 22 },
          { header: "Đơn vị", value: (r) => r.department.name, width: 30 },
          { header: "Hạn", value: (r) => formatDate(r.dueDate), width: 12 },
          { header: "Trạng thái", value: (r) => statusLabel(r.status, "report"), width: 18 },
          { header: "Số báo cáo", value: (r) => r.submission?.number, width: 16 },
          { header: "Ngày gửi", value: (r) => formatDate(r.submission?.sentDate), width: 12 },
          { header: "Nơi nhận", value: (r) => r.requirement.recipientAgency?.name, width: 26 },
        ],
        rows,
      );
    },
  },
  users: {
    permission: "user.manage",
    fileName: () => "Nguoi-dung.xlsx",
    build: define("Nguoi dung", () => listUsers(), [
      { header: "Tên đăng nhập", value: (u) => u.username, width: 16 },
      { header: "Họ và tên", value: (u) => u.fullName, width: 24 },
      { header: "Chức vụ", value: (u) => u.position, width: 22 },
      { header: "Đơn vị", value: (u) => u.department?.name, width: 30 },
      {
        header: "Vai trò",
        value: (u) => u.roles.map((r: Role) => ROLE_LABELS[r]).join(", "),
        width: 34,
      },
      { header: "Điện thoại", value: (u) => u.phone, width: 14 },
      { header: "Email", value: (u) => u.email, width: 24 },
      { header: "Đăng nhập gần nhất", value: (u) => formatDateTime(u.lastLoginAt), width: 18 },
      {
        header: "Trạng thái",
        value: (u) => (u.active ? "Đang hoạt động" : "Ngừng hoạt động"),
        width: 16,
      },
    ]),
  },
  departments: {
    permission: "department.manage",
    fileName: () => "Don-vi.xlsx",
    build: define("Don vi", () => listDepartments(), [
      { header: "Thứ tự", value: (d) => d.sortOrder, width: 8 },
      { header: "Tên đơn vị", value: (d) => d.name, width: 40 },
      { header: "Tên viết tắt", value: (d) => d.shortName, width: 14 },
      { header: "Số người dùng", value: (d) => d._count.users, format: "int", width: 14 },
      { header: "Trạng thái", value: (d) => activeLabel(d.active), width: 16 },
    ]),
  },
  "document-types": {
    permission: "catalog.manage",
    fileName: () => "Loai-van-ban.xlsx",
    build: define("Loai van ban", () => listDocumentTypes(), [
      { header: "Thứ tự", value: (d) => d.sortOrder, width: 8 },
      { header: "Mã", value: (d) => d.code, width: 8 },
      { header: "Tên loại", value: (d) => d.name, width: 22 },
      { header: "Dùng cho cấp 1 (Chương trình)", value: (d) => yesNo(d.isProgram), width: 18 },
      { header: "Màu nhãn", value: (d) => d.color, width: 11 },
      { header: "Số văn bản", value: (d) => d._count.documents, format: "int", width: 11 },
      { header: "Trạng thái", value: (d) => activeLabel(d.active), width: 16 },
    ]),
  },
  fields: {
    permission: "catalog.manage",
    fileName: () => "Linh-vuc.xlsx",
    build: define("Linh vuc", () => listFields(), [
      { header: "Thứ tự", value: (d) => d.sortOrder, width: 8 },
      { header: "Lĩnh vực", value: (d) => d.name, width: 30 },
      { header: "Số văn bản", value: (d) => d._count.documents, format: "int", width: 11 },
      { header: "Trạng thái", value: (d) => activeLabel(d.active), width: 16 },
    ]),
  },
  "issuing-agencies": {
    permission: "catalog.manage",
    fileName: () => "Co-quan-ban-hanh.xlsx",
    build: define("Co quan ban hanh", () => listIssuingAgencies(), [
      { header: "Tên cơ quan", value: (d) => d.name, width: 36 },
      { header: "Cấp", value: (d) => d.level, width: 14 },
      { header: "Số văn bản", value: (d) => d._count.documents, format: "int", width: 11 },
      { header: "Trạng thái", value: (d) => activeLabel(d.active), width: 16 },
    ]),
  },
  "old-areas": {
    permission: "catalog.manage",
    fileName: () => "Khu-vuc-cu.xlsx",
    build: define("Khu vuc cu", () => listOldAreas(), [
      { header: "Thứ tự", value: (d) => d.sortOrder, width: 8 },
      { header: "Khu vực (trước sáp nhập)", value: (d) => d.name, width: 26 },
      { header: "Số TDP", value: (d) => d._count.residentials, format: "int", width: 10 },
    ]),
  },
};

export function exportFileStamp(): string {
  return formatDate(new Date()).replace(/\//g, "-");
}
