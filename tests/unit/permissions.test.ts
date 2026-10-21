import { describe, expect, it } from "vitest";

import type { Role } from "@/generated/prisma/enums";
import {
  can,
  canViewAllDocuments,
  homePathFor,
  type Action,
  type AuthUser,
  type DocumentResource,
  type TaskResource,
} from "@/lib/permissions";

const DEPT = "dept-own";
const OTHER = "dept-other";

const userOf = (role: Role, extra: Partial<AuthUser> = {}): AuthUser => ({
  id: `u-${role}`,
  roles: [role],
  departmentId: DEPT,
  ...extra,
});

const R: Role[] = ["ADMIN", "LEADER", "CLERK", "OFFICER", "PARTY_ADMIN", "VIEWER"];

/** Kỳ vọng theo thứ tự cột của bảng Mục 12: ADMIN, LEADER, CLERK, OFFICER, PARTY_ADMIN, VIEWER */
function expectRow(
  action: Action,
  expected: [boolean, boolean, boolean, boolean, boolean, boolean],
) {
  R.forEach((role, i) => {
    expect(can(userOf(role), action), `${action} / ${role}`).toBe(expected[i]);
  });
}

describe("bảng phân quyền Mục 12 — quyền không phụ thuộc đối tượng", () => {
  it("Xem dashboard đầy đủ / rút gọn", () => {
    expectRow("dashboard.viewFull", [true, true, true, false, true, false]);
    expectRow("dashboard.viewReduced", [true, true, true, true, true, true]);
  });

  it("Giao việc", () => expectRow("task.assign", [true, true, true, false, true, false]));
  it("Mở khoá bản nộp báo cáo quá 24 giờ: ADMIN, LEADER", () =>
    expectRow("report.unlock", [true, true, false, false, false, false]));
  it("Tạo yêu cầu báo cáo", () =>
    expectRow("report.createRequirement", [true, true, true, false, true, false]));

  it("Danh mục trường, TDP: ADMIN & CLERK sửa, mọi vai trò xem", () => {
    expectRow("school.manage", [true, false, true, false, false, false]);
    expectRow("residential.manage", [true, false, true, false, false, false]);
    expectRow("school.view", [true, true, true, true, true, true]);
    expectRow("residential.view", [true, true, true, true, true, true]);
  });

  it("Danh mục tổ chức đảng: ADMIN & PARTY_ADMIN sửa", () => {
    expectRow("partyOrg.manage", [true, false, false, false, true, false]);
    expectRow("partyOrg.view", [true, true, true, true, true, true]);
    expectRow("partyStats.override", [true, false, false, false, true, false]);
  });

  it("Thông tin phường: chỉ ADMIN sửa", () => {
    expectRow("ward.update", [true, false, false, false, false, false]);
    expectRow("ward.view", [true, true, true, true, true, true]);
  });

  it("Quản trị người dùng, cấu hình; nhật ký cho cả LEADER", () => {
    expectRow("user.manage", [true, false, false, false, false, false]);
    expectRow("department.manage", [true, false, false, false, false, false]);
    expectRow("catalog.manage", [true, false, false, false, false, false]);
    expectRow("setting.manage", [true, false, false, false, false, false]);
    expectRow("auditLog.view", [true, true, false, false, false, false]);
    expectRow("trash.manage", [true, false, false, false, false, false]);
  });

  it("Chuông thông báo và tìm kiếm Ctrl+K: mọi vai trò", () => {
    expectRow("notification.view", [true, true, true, true, true, true]);
    expectRow("search.global", [true, true, true, true, true, true]);
  });

  it("VIEWER không có Việc của tôi, Công việc, Báo cáo", () => {
    expectRow("myWork.view", [true, true, true, true, true, false]);
    expectRow("task.list", [true, true, true, true, true, false]);
    expectRow("report.list", [true, true, true, true, true, false]);
  });
});

describe("văn bản — theo đối tượng", () => {
  const doc = (over: Partial<DocumentResource> = {}): DocumentResource => ({
    createdById: "someone",
    leadDepartmentId: OTHER,
    coDepartmentIds: [],
    isInternalPublic: false,
    fieldName: "Kinh tế",
    ...over,
  });

  it("ADMIN, LEADER, CLERK, PARTY_ADMIN xem tất cả", () => {
    for (const role of ["ADMIN", "LEADER", "CLERK", "PARTY_ADMIN"] as Role[]) {
      expect(can(userOf(role), "document.view", doc())).toBe(true);
    }
  });

  it("OFFICER: đơn vị mình chủ trì/phối hợp, có việc giao, hoặc công khai nội bộ", () => {
    const officer = userOf("OFFICER");
    expect(can(officer, "document.view", doc())).toBe(false);
    expect(can(officer, "document.view", doc({ leadDepartmentId: DEPT }))).toBe(true);
    expect(can(officer, "document.view", doc({ coDepartmentIds: [DEPT] }))).toBe(true);
    expect(can(officer, "document.view", doc({ isInternalPublic: true }))).toBe(true);
    expect(can(officer, "document.view", doc({ taskUserIds: [officer.id] }))).toBe(true);
    expect(can(officer, "document.view", doc({ taskDepartmentIds: [DEPT] }))).toBe(true);
  });

  it("OFFICER không có đơn vị thì không khớp theo đơn vị", () => {
    const officer = userOf("OFFICER", { departmentId: null });
    expect(can(officer, "document.view", doc({ leadDepartmentId: null }))).toBe(false);
  });

  it("VIEWER: chỉ văn bản được chia sẻ (kể cả công khai nội bộ cũng không)", () => {
    const viewer = userOf("VIEWER");
    expect(can(viewer, "document.view", doc({ isInternalPublic: true }))).toBe(false);
    expect(can(viewer, "document.view", doc({ sharedUserIds: [viewer.id] }))).toBe(true);
  });

  it("Tạo/sửa: ADMIN, LEADER, CLERK; PARTY_ADMIN chỉ lĩnh vực Xây dựng Đảng; OFFICER, VIEWER không", () => {
    expectRow("document.create", [true, true, true, false, true, false]);
    const party = userOf("PARTY_ADMIN");
    expect(can(party, "document.update", doc({ fieldName: "Xây dựng Đảng" }))).toBe(true);
    expect(can(party, "document.update", doc({ fieldName: "xay dung dang" }))).toBe(true);
    expect(can(party, "document.update", doc({ fieldName: "Kinh tế" }))).toBe(false);
    expect(can(party, "document.create", doc({ fieldName: null }))).toBe(false);
    expect(can(userOf("CLERK"), "document.update", doc())).toBe(true);
  });

  it("Xoá: ADMIN, LEADER tất cả; CLERK, PARTY_ADMIN chỉ văn bản do mình tạo", () => {
    expect(can(userOf("LEADER"), "document.delete", doc())).toBe(true);
    const clerk = userOf("CLERK");
    expect(can(clerk, "document.delete", doc())).toBe(false);
    expect(can(clerk, "document.delete", doc({ createdById: clerk.id }))).toBe(true);
    const party = userOf("PARTY_ADMIN");
    expect(can(party, "document.delete", doc({ createdById: party.id }))).toBe(true);
    expect(can(userOf("OFFICER"), "document.delete", doc({ createdById: "u-OFFICER" }))).toBe(
      false,
    );
  });
});

describe("công việc — theo đối tượng", () => {
  const task = (over: Partial<TaskResource> = {}): TaskResource => ({
    assignerId: "boss",
    leadUserId: "someone",
    leadDepartmentId: OTHER,
    coUserIds: [],
    coDepartmentIds: [],
    ...over,
  });

  it("Cập nhật tiến độ: OFFICER việc của mình hoặc đơn vị mình", () => {
    const officer = userOf("OFFICER");
    expect(can(officer, "task.updateProgress", task())).toBe(false);
    expect(can(officer, "task.updateProgress", task({ leadUserId: officer.id }))).toBe(true);
    expect(can(officer, "task.updateProgress", task({ coUserIds: [officer.id] }))).toBe(true);
    expect(can(officer, "task.updateProgress", task({ leadDepartmentId: DEPT }))).toBe(true);
    expect(can(officer, "task.updateProgress", task({ coDepartmentIds: [DEPT] }))).toBe(true);
  });

  it("Cập nhật tiến độ: PARTY_ADMIN chỉ việc của mình (không tính theo đơn vị)", () => {
    const party = userOf("PARTY_ADMIN");
    expect(can(party, "task.updateProgress", task({ leadDepartmentId: DEPT }))).toBe(false);
    expect(can(party, "task.updateProgress", task({ leadUserId: party.id }))).toBe(true);
  });

  it("Cập nhật tiến độ: ADMIN, LEADER, CLERK mọi việc; VIEWER không", () => {
    for (const role of ["ADMIN", "LEADER", "CLERK"] as Role[]) {
      expect(can(userOf(role), "task.updateProgress", task())).toBe(true);
    }
    expect(can(userOf("VIEWER"), "task.updateProgress", task({ leadUserId: "u-VIEWER" }))).toBe(
      false,
    );
  });

  it("Duyệt hoàn thành / gia hạn: ADMIN, LEADER; CLERK & PARTY_ADMIN khi là người giao", () => {
    expect(can(userOf("LEADER"), "task.approve", task())).toBe(true);
    const clerk = userOf("CLERK");
    expect(can(clerk, "task.approve", task())).toBe(false);
    expect(can(clerk, "task.approve", task({ assignerId: clerk.id }))).toBe(true);
    const party = userOf("PARTY_ADMIN");
    expect(can(party, "task.approve", task({ assignerId: party.id }))).toBe(true);
    expect(can(userOf("OFFICER"), "task.approve", task({ assignerId: "u-OFFICER" }))).toBe(false);
  });
});

describe("nộp báo cáo — theo đơn vị", () => {
  it("ADMIN, LEADER, CLERK mọi kỳ; OFFICER, PARTY_ADMIN chỉ đơn vị mình; VIEWER không", () => {
    const other = { departmentId: OTHER };
    const own = { departmentId: DEPT };
    for (const role of ["ADMIN", "LEADER", "CLERK"] as Role[]) {
      expect(can(userOf(role), "report.submit", other)).toBe(true);
    }
    for (const role of ["OFFICER", "PARTY_ADMIN"] as Role[]) {
      expect(can(userOf(role), "report.submit", other)).toBe(false);
      expect(can(userOf(role), "report.submit", own)).toBe(true);
    }
    expect(can(userOf("VIEWER"), "report.submit", own)).toBe(false);
  });
});

describe("nhiều vai trò & trường hợp biên", () => {
  it("được phép nếu bất kỳ vai trò nào cho phép", () => {
    const user: AuthUser = { id: "x", roles: ["OFFICER", "PARTY_ADMIN"], departmentId: DEPT };
    expect(can(user, "partyOrg.manage")).toBe(true);
    expect(can(user, "school.manage")).toBe(false);
  });

  it("không đăng nhập hoặc không có vai trò → không có quyền gì", () => {
    expect(can(null, "document.list")).toBe(false);
    expect(can({ id: "x", roles: [], departmentId: null }, "ward.view")).toBe(false);
  });

  it("trang mặc định: OFFICER → Việc của tôi; người xem được bảng đầy đủ → Bảng điều hành", () => {
    expect(homePathFor(userOf("OFFICER"))).toBe("/viec-cua-toi");
    expect(homePathFor(userOf("VIEWER"))).toBe("/");
    expect(homePathFor(userOf("LEADER"))).toBe("/");
    expect(homePathFor({ id: "x", roles: ["OFFICER", "CLERK"], departmentId: DEPT })).toBe("/");
  });
});

describe("phạm vi xem văn bản", () => {
  it("ADMIN, LEADER, CLERK, PARTY_ADMIN xem tất cả; OFFICER, VIEWER bị lọc", () => {
    expect(R.map((role) => canViewAllDocuments(userOf(role)))).toEqual([
      true,
      true,
      true,
      false,
      true,
      false,
    ]);
    expect(canViewAllDocuments({ id: "x", roles: ["OFFICER", "CLERK"], departmentId: null })).toBe(
      true,
    );
  });
});
