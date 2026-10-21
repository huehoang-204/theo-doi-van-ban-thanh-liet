// Hiển thị nhật ký hệ thống (Mục 13.2): nhãn tiếng Việt, tóm tắt đối tượng, các trường thay đổi.
// Hàm thuần — dùng chung trang Nhật ký và xuất Excel; có unit test.
import type { Route } from "next";

import { formatDate, formatDateTime } from "@/lib/format";

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  CREATE: "Thêm mới",
  UPDATE: "Sửa",
  DELETE: "Xoá (vào Thùng rác)",
  RESTORE: "Khôi phục",
  PURGE: "Xoá vĩnh viễn",
  PUBLISH: "Ban hành / gửi văn bản",
  MOVE: "Di chuyển",
  LOGIN: "Đăng nhập",
  LOGIN_FAILED: "Đăng nhập sai",
  LOGOUT: "Đăng xuất",
  CHANGE_PASSWORD: "Đổi mật khẩu",
  RESET_PASSWORD: "Đặt lại mật khẩu",
  UNLOCK: "Mở khoá",
  IMPORT: "Nhập Excel",
  EXPORT: "Xuất dữ liệu",
  DOWNLOAD: "Tải / xem tệp",
};

export const AUDIT_ENTITY_LABELS: Record<string, string> = {
  DocumentNode: "Văn bản",
  Attachment: "Tệp đính kèm",
  DocumentComment: "Thảo luận văn bản",
  Task: "Công việc",
  TaskUpdate: "Cập nhật tiến độ",
  TaskExtension: "Gia hạn công việc",
  ReportRequirement: "Yêu cầu báo cáo",
  ReportSubmission: "Bản nộp báo cáo",
  User: "Người dùng",
  Department: "Đơn vị",
  WardProfile: "Thông tin phường",
  School: "Trường học",
  SchoolYearStat: "Số liệu năm học",
  Residential: "Tổ dân phố",
  PartyOrg: "Tổ chức đảng",
  DocumentType: "Loại văn bản",
  Field: "Lĩnh vực",
  IssuingAgency: "Cơ quan ban hành",
  OldArea: "Khu vực cũ",
  Setting: "Cấu hình",
  // Xuất / nhập Excel ghi theo loại dữ liệu
  documents: "Cây văn bản (Excel)",
  tasks: "Danh sách công việc (Excel)",
  reports: "Kỳ báo cáo (Excel)",
  schools: "Trường học (Excel)",
  residentials: "Tổ dân phố (Excel)",
  "party-orgs": "Tổ chức đảng (Excel)",
  "audit-log": "Nhật ký (Excel)",
};

export const actionLabel = (a: string) => AUDIT_ACTION_LABELS[a] ?? a;
export const entityLabel = (e: string) => AUDIT_ENTITY_LABELS[e] ?? e;

/** Nhãn tên trường hay gặp trong before/after */
const FIELD_LABELS: Record<string, string> = {
  title: "Trích yếu / tên",
  number: "Số, ký hiệu",
  name: "Tên",
  fullName: "Họ tên",
  username: "Tên đăng nhập",
  roles: "Vai trò",
  active: "Đang hoạt động",
  departmentId: "Đơn vị",
  dueDate: "Hạn",
  startDate: "Ngày bắt đầu",
  endDate: "Ngày kết thúc",
  issuedDate: "Ngày ban hành",
  effectiveDate: "Ngày hiệu lực",
  progress: "Tiến độ (%)",
  flow: "Bước",
  priority: "Mức ưu tiên",
  note: "Ghi chú",
  content: "Nội dung",
  description: "Mô tả",
  summary: "Tóm tắt",
  validity: "Hiệu lực",
  fileName: "Tên tệp",
  population: "Nhân khẩu",
  households: "Số hộ",
  memberCount: "Số đảng viên",
  students: "Học sinh",
  staffTotal: "CB-GV-NV",
  areaKm2: "Diện tích (km²)",
  deletedAt: "Thời điểm xoá",
  cascadeCount: "Số văn bản con",
  count: "Số bản ghi",
  reason: "Lý do",
  mode: "Cách mở",
  period: "Kỳ báo cáo",
  sentDate: "Ngày gửi",
  requestedDate: "Hạn đề nghị",
  decision: "Quyết định",
  namHoc: "Năm học",
  rows: "Số dòng",
  recipients: "Số người nhận",
  added: "Người nhận mới",
  recipientAll: "Gửi toàn phường",
  message: "Lời gửi kèm",
};

const fieldLabel = (k: string) => FIELD_LABELS[k] ?? k;

/** Trường kỹ thuật không hiện trong phần chi tiết */
const HIDDEN_FIELDS = new Set([
  "id",
  "path",
  "searchText",
  "createdAt",
  "updatedAt",
  "createdById",
  "updatedById",
  "rootId",
  "depth",
  "sortOrder",
  "passwordHash",
  "isSample",
]);

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}T00:00:00(\.000)?Z$/;
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

export function formatAuditValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Có" : "Không";
  if (typeof v === "number") return new Intl.NumberFormat("vi-VN").format(v);
  if (typeof v === "string") {
    if (DATE_ONLY.test(v)) return formatDate(new Date(v));
    if (DATE_TIME.test(v)) return formatDateTime(new Date(v));
    return v.length > 200 ? `${v.slice(0, 199)}…` : v;
  }
  if (Array.isArray(v)) return v.length === 0 ? "—" : v.map(formatAuditValue).join(", ");
  return JSON.stringify(v);
}

const asRecord = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

/** Tên ngắn của đối tượng từ before/after (số + trích yếu, tên, tên tệp…) */
export function auditSubject(before: unknown, after: unknown): string | null {
  for (const v of [asRecord(after), asRecord(before)]) {
    if (!v) continue;
    const title = v.title ?? v.name ?? v.fullName ?? v.fileName ?? v.username;
    if (typeof title === "string" && title) {
      return typeof v.number === "string" && v.number && !title.startsWith(v.number)
        ? `${v.number} — ${title}`
        : title;
    }
    if (typeof v.number === "string" && v.number) return v.number;
  }
  return null;
}

export type AuditDetail = { field: string; label: string; before?: string; after: string };

/**
 * Chi tiết hiển thị: có cả before và after → chỉ các trường thay đổi (cũ → mới);
 * chỉ một bên → liệt kê giá trị. Bỏ trường kỹ thuật.
 */
export function auditDetails(before: unknown, after: unknown): AuditDetail[] {
  const b = asRecord(before);
  const a = asRecord(after);
  if (b && a) {
    const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])].filter(
      (k) => !HIDDEN_FIELDS.has(k),
    );
    return keys
      .filter((k) => JSON.stringify(b[k] ?? null) !== JSON.stringify(a[k] ?? null))
      .map((k) => ({
        field: k,
        label: fieldLabel(k),
        before: formatAuditValue(b[k]),
        after: formatAuditValue(a[k]),
      }));
  }
  const one = a ?? b;
  if (!one) return [];
  return Object.entries(one)
    .filter(([k, v]) => !HIDDEN_FIELDS.has(k) && v !== null && v !== undefined && v !== "")
    .map(([k, v]) => ({ field: k, label: fieldLabel(k), after: formatAuditValue(v) }));
}

/** Liên kết tới đối tượng (nếu có trang riêng) */
export function auditEntityHref(
  entity: string,
  entityId: string | null,
  action: string,
): Route | null {
  if (action === "PURGE") return null; // đã xoá vĩnh viễn
  switch (entity) {
    case "DocumentNode":
      return entityId ? (`/van-ban/${entityId}` as Route) : null;
    case "Task":
      return entityId ? (`/cong-viec/${entityId}` as Route) : null;
    case "ReportRequirement":
      return entityId ? (`/bao-cao?yeuCau=${entityId}` as Route) : "/bao-cao";
    case "User":
      return "/quan-tri/nguoi-dung";
    case "Department":
      return "/quan-tri/don-vi";
    case "School":
    case "SchoolYearStat":
    case "schools":
      return "/dia-ban/truong-hoc";
    case "Residential":
    case "residentials":
      return "/dia-ban/to-dan-pho";
    case "PartyOrg":
    case "party-orgs":
      return "/dia-ban/to-chuc-dang";
    case "WardProfile":
      return "/dia-ban/thong-tin-phuong";
    default:
      return null;
  }
}
