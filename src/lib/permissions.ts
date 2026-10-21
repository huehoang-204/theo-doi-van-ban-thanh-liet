// Phân quyền tập trung — bảng Mục 12 đặc tả. Component/action KHÔNG tự viết điều kiện vai trò,
// luôn gọi can(user, action, resource?).
//
// Quy ước: một người nhiều vai trò → được phép nếu BẤT KỲ vai trò nào cho phép.
// Hành động phụ thuộc đối tượng (VD "việc của mình") gọi KHÔNG kèm resource sẽ trả lời câu hỏi
// "người này có thể làm việc này với ÍT NHẤT MỘT đối tượng không" — dùng để hiện menu/nút.

import type { Role } from "@/generated/prisma/enums";
import { normalizeForSearch } from "@/lib/text";

export type AuthUser = {
  id: string;
  roles: readonly Role[];
  departmentId: string | null;
};

export type Action =
  // Bảng điều hành
  | "dashboard.viewFull"
  | "dashboard.viewReduced"
  | "myWork.view"
  // Văn bản
  | "document.list"
  | "document.view"
  | "document.create"
  | "document.update"
  | "document.delete"
  // Công việc
  | "task.list"
  | "task.assign"
  | "task.updateProgress"
  | "task.approve"
  // Báo cáo
  | "report.list"
  | "report.createRequirement"
  | "report.submit"
  | "report.unlock"
  // Địa bàn
  | "ward.view"
  | "ward.update"
  | "school.view"
  | "school.manage"
  | "residential.view"
  | "residential.manage"
  | "partyOrg.view"
  | "partyOrg.manage"
  | "partyStats.override"
  // Quản trị
  | "catalog.manage"
  | "department.manage"
  | "user.manage"
  | "setting.manage"
  | "auditLog.view"
  | "trash.manage"
  // Chung
  | "notification.view"
  | "search.global";

/** Văn bản: các trường cần để xét quyền xem/sửa/xoá */
export type DocumentResource = {
  createdById: string;
  leadDepartmentId: string | null;
  coDepartmentIds: readonly string[];
  isInternalPublic: boolean;
  /** Tên lĩnh vực (PARTY_ADMIN chỉ tạo/sửa văn bản lĩnh vực Xây dựng Đảng) */
  fieldName?: string | null;
  /** Người được chia sẻ (VIEWER) */
  sharedUserIds?: readonly string[];
  /** Người/đơn vị có công việc gắn với văn bản (OFFICER xem được) */
  taskUserIds?: readonly string[];
  taskDepartmentIds?: readonly string[];
};

export type TaskResource = {
  assignerId: string;
  leadUserId: string | null;
  leadDepartmentId: string | null;
  coUserIds: readonly string[];
  coDepartmentIds: readonly string[];
};

export type ReportPeriodResource = { departmentId: string };

type ResourceOf<A extends Action> = A extends `document.${"view" | "create" | "update" | "delete"}`
  ? DocumentResource
  : A extends "task.updateProgress" | "task.approve"
    ? TaskResource
    : A extends "report.submit"
      ? ReportPeriodResource
      : never;

/** Lĩnh vực mà PARTY_ADMIN được tạo/sửa văn bản */
export const PARTY_FIELD_NAME = "Xây dựng Đảng";

const ALL_ROLES: readonly Role[] = ["ADMIN", "LEADER", "CLERK", "OFFICER", "PARTY_ADMIN", "VIEWER"];

/** Vai trò được phép tuyệt đối (không phụ thuộc đối tượng) */
const ROLE_GRANTS: Record<Action, readonly Role[]> = {
  "dashboard.viewFull": ["ADMIN", "LEADER", "CLERK", "PARTY_ADMIN"],
  "dashboard.viewReduced": ALL_ROLES,
  "myWork.view": ["ADMIN", "LEADER", "CLERK", "OFFICER", "PARTY_ADMIN"],

  "document.list": ALL_ROLES,
  "document.view": ["ADMIN", "LEADER", "CLERK", "PARTY_ADMIN"],
  "document.create": ["ADMIN", "LEADER", "CLERK"],
  "document.update": ["ADMIN", "LEADER", "CLERK"],
  "document.delete": ["ADMIN", "LEADER"],

  "task.list": ["ADMIN", "LEADER", "CLERK", "OFFICER", "PARTY_ADMIN"],
  "task.assign": ["ADMIN", "LEADER", "CLERK", "PARTY_ADMIN"],
  "task.updateProgress": ["ADMIN", "LEADER", "CLERK"],
  "task.approve": ["ADMIN", "LEADER"],

  "report.list": ["ADMIN", "LEADER", "CLERK", "OFFICER", "PARTY_ADMIN"],
  "report.createRequirement": ["ADMIN", "LEADER", "CLERK", "PARTY_ADMIN"],
  "report.submit": ["ADMIN", "LEADER", "CLERK"],
  // Mở khoá bản nộp quá 24 giờ để sửa (Mục 5.1)
  "report.unlock": ["ADMIN", "LEADER"],

  "ward.view": ALL_ROLES,
  "ward.update": ["ADMIN"],
  "school.view": ALL_ROLES,
  "school.manage": ["ADMIN", "CLERK"],
  "residential.view": ALL_ROLES,
  "residential.manage": ["ADMIN", "CLERK"],
  "partyOrg.view": ALL_ROLES,
  "partyOrg.manage": ["ADMIN", "PARTY_ADMIN"],
  "partyStats.override": ["ADMIN", "PARTY_ADMIN"],

  "catalog.manage": ["ADMIN"],
  "department.manage": ["ADMIN"],
  "user.manage": ["ADMIN"],
  "setting.manage": ["ADMIN"],
  "auditLog.view": ["ADMIN", "LEADER"],
  "trash.manage": ["ADMIN"],

  // Chuông thông báo & tìm kiếm Ctrl+K: mọi người (kết quả tìm vẫn lọc theo phạm vi xem)
  "notification.view": ALL_ROLES,
  "search.global": ALL_ROLES,
};

function hasAnyRole(user: AuthUser, roles: readonly Role[]): boolean {
  return user.roles.some((r) => roles.includes(r));
}

function inDepartment(user: AuthUser, ids: ReadonlyArray<string | null>): boolean {
  return user.departmentId !== null && ids.includes(user.departmentId);
}

function isPartyField(fieldName: string | null | undefined): boolean {
  return !!fieldName && normalizeForSearch(fieldName) === normalizeForSearch(PARTY_FIELD_NAME);
}

/** Quyền có điều kiện theo đối tượng (bổ sung cho ROLE_GRANTS). Không có resource → "có thể với ít nhất một đối tượng". */
function conditionalGrant(user: AuthUser, action: Action, resource: unknown): boolean {
  const has = (role: Role) => user.roles.includes(role);

  switch (action) {
    case "document.view": {
      const doc = resource as DocumentResource | undefined;
      if (has("OFFICER")) {
        if (!doc) return true;
        if (doc.isInternalPublic) return true;
        if (inDepartment(user, [doc.leadDepartmentId, ...doc.coDepartmentIds])) return true;
        if (doc.taskUserIds?.includes(user.id)) return true;
        if (inDepartment(user, doc.taskDepartmentIds ?? [])) return true;
      }
      if (has("VIEWER")) {
        if (!doc) return true;
        if (doc.sharedUserIds?.includes(user.id)) return true;
      }
      return false;
    }
    case "document.create":
    case "document.update": {
      const doc = resource as DocumentResource | undefined;
      return has("PARTY_ADMIN") && (!doc || isPartyField(doc.fieldName));
    }
    case "document.delete": {
      const doc = resource as DocumentResource | undefined;
      return (has("CLERK") || has("PARTY_ADMIN")) && (!doc || doc.createdById === user.id);
    }
    case "task.updateProgress": {
      const task = resource as TaskResource | undefined;
      if (has("OFFICER")) {
        if (!task) return true;
        if (task.leadUserId === user.id || task.coUserIds.includes(user.id)) return true;
        if (inDepartment(user, [task.leadDepartmentId, ...task.coDepartmentIds])) return true;
      }
      if (has("PARTY_ADMIN")) {
        if (!task) return true;
        if (task.leadUserId === user.id || task.coUserIds.includes(user.id)) return true;
      }
      return false;
    }
    case "task.approve": {
      const task = resource as TaskResource | undefined;
      return (has("CLERK") || has("PARTY_ADMIN")) && (!task || task.assignerId === user.id);
    }
    case "report.submit": {
      const period = resource as ReportPeriodResource | undefined;
      return (
        (has("OFFICER") || has("PARTY_ADMIN")) &&
        (!period || inDepartment(user, [period.departmentId]))
      );
    }
    default:
      return false;
  }
}

export function can<A extends Action>(
  user: AuthUser | null | undefined,
  action: A,
  resource?: ResourceOf<A>,
): boolean {
  if (!user || user.roles.length === 0) return false;
  if (hasAnyRole(user, ROLE_GRANTS[action])) return true;
  return conditionalGrant(user, action, resource);
}

/**
 * Xem được MỌI văn bản (ADMIN, LEADER, CLERK, PARTY_ADMIN). OFFICER/VIEWER chỉ xem theo phạm vi
 * (đơn vị chủ trì/phối hợp, việc được giao, công khai nội bộ, được chia sẻ) → cây phải lọc.
 */
export function canViewAllDocuments(user: AuthUser): boolean {
  return hasAnyRole(user, ROLE_GRANTS["document.view"]);
}

/** Trang mặc định sau đăng nhập: cán bộ (chỉ OFFICER/VIEWER) không xem được bảng đầy đủ → "Việc của tôi" (Mục 5.3) */
export function homePathFor(user: AuthUser): "/" | "/viec-cua-toi" {
  if (can(user, "dashboard.viewFull")) return "/";
  return user.roles.includes("OFFICER") ? "/viec-cua-toi" : "/";
}

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Quản trị hệ thống",
  LEADER: "Lãnh đạo",
  CLERK: "Văn thư / Văn phòng",
  OFFICER: "Cán bộ / Chuyên viên",
  PARTY_ADMIN: "Ban Xây dựng Đảng",
  VIEWER: "Chỉ xem",
};

export const ROLES: readonly Role[] = ALL_ROLES;
