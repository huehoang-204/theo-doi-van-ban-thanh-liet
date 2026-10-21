import { describe, expect, it } from "vitest";

import {
  countBy,
  latest,
  overdueByDepartment,
  populationDensity,
  sortProgramsByProgress,
  sumBy,
  taskBuckets,
  upcomingReports,
  withOverride,
  type DashboardTask,
} from "@/lib/dashboard";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const now = new Date("2026-10-21T02:00:00Z"); // 09:00 ngày 21/10 giờ VN

describe("thẻ địa bàn", () => {
  it("mật độ dân số theo số liệu phường: 92.000 / 6,44 ≈ 14.286", () => {
    expect(populationDensity(92000, 6.44)).toBe(14286);
    expect(populationDensity(92000, 0)).toBeNull();
  });

  it("tổ chức đảng: override khi có, nếu không thì số đếm danh mục (kể cả override = 0)", () => {
    expect(withOverride(62, 63)).toEqual({ value: 63, overridden: true });
    expect(withOverride(62, null)).toEqual({ value: 62, overridden: false });
    expect(withOverride(62, 0)).toEqual({ value: 0, overridden: true });
  });
});

describe("khối Tình hình thực hiện nhiệm vụ", () => {
  const t = (over: Partial<DashboardTask>): DashboardTask => ({
    flow: "IN_PROGRESS",
    dueDate: null,
    completedAt: null,
    submittedAt: null,
    leadDepartmentId: "A",
    ...over,
  });
  const tasks = [
    t({ dueDate: d("2026-10-20") }), // quá hạn
    t({ dueDate: d("2026-10-10"), leadDepartmentId: "B" }), // quá hạn
    t({ dueDate: d("2026-10-05"), leadDepartmentId: "B", flow: "NEW" }), // quá hạn
    t({ dueDate: d("2026-10-23") }), // sắp hạn
    t({ dueDate: d("2026-11-30") }), // đang làm
    t({ dueDate: null }), // đang làm (không hạn)
    t({ flow: "DONE", dueDate: d("2026-10-01"), completedAt: d("2026-10-02") }), // xong (trễ vẫn là xong)
    t({ flow: "SUBMITTED", dueDate: d("2026-10-01"), submittedAt: d("2026-09-30") }), // chờ duyệt: không thẻ nào
    t({ flow: "CANCELLED", dueDate: d("2026-10-01") }), // huỷ: không tính
  ];

  it("4 thẻ: Quá hạn / Sắp hạn / Đang làm / Xong", () => {
    expect(taskBuckets(tasks, now)).toEqual({ overdue: 3, dueSoon: 1, inProgress: 2, done: 1 });
  });

  it("việc quá hạn theo đơn vị chủ trì, nhiều nhất trước", () => {
    expect(overdueByDepartment(tasks, now)).toEqual([
      { departmentId: "B", count: 2 },
      { departmentId: "A", count: 1 },
    ]);
  });

  it("báo cáo cần nộp trong 14 ngày: gồm cả quá hạn, bỏ kỳ đã nộp, quá hạn lên đầu", () => {
    const rows = [
      { id: "a", daysLeft: 10, status: "CHUA_DEN_HAN" as const, submitted: false },
      { id: "b", daysLeft: -5, status: "QUA_HAN" as const, submitted: false },
      { id: "c", daysLeft: 2, status: "SAP_DEN_HAN" as const, submitted: false },
      { id: "d", daysLeft: 20, status: "CHUA_DEN_HAN" as const, submitted: false },
      { id: "e", daysLeft: 1, status: "HOAN_THANH" as const, submitted: true },
    ];
    expect(upcomingReports(rows).map((r) => r.id)).toEqual(["b", "c", "a"]);
  });

  it("tiến độ chương trình xếp % tăng dần, chương trình chưa có việc xếp cuối", () => {
    const programs = [
      { title: "B", progress: 70 },
      { title: "A", progress: null },
      { title: "C", progress: 20 },
    ];
    expect(sortProgramsByProgress(programs).map((p) => p.title)).toEqual(["C", "B", "A"]);
  });
});

describe("tiện ích nhóm", () => {
  it("đếm theo thứ tự cho trước, bỏ nhóm rỗng; cộng bỏ qua null; mốc mới nhất", () => {
    expect(countBy(["THCS", "MAM_NON", "THCS"], (x) => x, ["MAM_NON", "TIEU_HOC", "THCS"])).toEqual(
      [
        { key: "MAM_NON", count: 1 },
        { key: "THCS", count: 2 },
      ],
    );
    expect(sumBy([{ v: 1 }, { v: null }, { v: 5 }], (x) => x.v)).toBe(6);
    expect(latest([d("2026-01-01"), null, d("2026-03-01")])).toEqual(d("2026-03-01"));
    expect(latest([])).toBeNull();
  });
});
