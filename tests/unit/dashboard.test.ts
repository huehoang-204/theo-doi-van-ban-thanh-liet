import { describe, expect, it } from "vitest";

import {
  countBy,
  latest,
  monthWindow,
  reportMonthly,
  sumByKey,
  taskTrend,
  vnMonthKey,
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

describe("biểu đồ theo tháng", () => {
  const vn = (iso: string) => new Date(`${iso}+07:00`);
  const now = vn("2026-10-21T09:00:00");

  it("6 tháng gần nhất theo giờ VN, qua năm đúng", () => {
    expect(monthWindow(now).map((m) => m.label)).toEqual([
      "T5/2026",
      "T6/2026",
      "T7/2026",
      "T8/2026",
      "T9/2026",
      "T10/2026",
    ]);
    expect(monthWindow(vn("2026-02-01T00:30:00"), 3).map((m) => m.key)).toEqual([
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
    // 17:30 UTC 31/10 là sáng 01/11 ở VN
    expect(vnMonthKey(new Date("2026-10-31T17:30:00Z"))).toBe("2026-11");
  });

  it("công việc giao mới & hoàn thành theo tháng; bỏ việc huỷ và ngoài khoảng", () => {
    const trend = taskTrend(
      [
        { createdAt: vn("2026-10-02T08:00:00"), completedAt: null, flow: "IN_PROGRESS" },
        {
          createdAt: vn("2026-09-10T08:00:00"),
          completedAt: vn("2026-10-05T10:00:00"),
          flow: "DONE",
        },
        { createdAt: vn("2026-09-12T08:00:00"), completedAt: null, flow: "CANCELLED" },
        {
          createdAt: vn("2026-01-12T08:00:00"),
          completedAt: vn("2026-09-30T23:30:00"),
          flow: "DONE",
        },
      ],
      now,
    );
    const by = Object.fromEntries(trend.map((t) => [t.key, [t.assigned, t.done]]));
    expect(by["2026-10"]).toEqual([1, 1]);
    expect(by["2026-09"]).toEqual([1, 1]); // việc huỷ không tính; hoàn thành 23:30 ngày 30/9 vẫn là T9
    expect(trend).toHaveLength(6);
  });

  it("kỳ báo cáo theo tháng hạn nộp: đúng hạn / trễ / quá hạn / chưa đến hạn", () => {
    const rows = reportMonthly(
      [
        { dueDate: d("2026-10-20"), status: "HOAN_THANH" },
        { dueDate: d("2026-10-20"), status: "QUA_HAN" },
        { dueDate: d("2026-10-31"), status: "SAP_DEN_HAN" },
        { dueDate: d("2026-09-20"), status: "HOAN_THANH_TRE" },
        { dueDate: d("2026-03-20"), status: "QUA_HAN" }, // ngoài 6 tháng
      ],
      now,
    );
    expect(rows.find((r) => r.key === "2026-10")).toMatchObject({
      onTime: 1,
      overdue: 1,
      pending: 1,
      late: 0,
    });
    expect(rows.find((r) => r.key === "2026-09")).toMatchObject({ late: 1 });
    expect(rows.reduce((s, r) => s + r.overdue, 0)).toBe(1);
  });

  it("cộng theo khoá giữ thứ tự, bỏ nhóm 0", () => {
    expect(
      sumByKey(
        [
          { k: "B", v: 3 },
          { k: "A", v: null },
          { k: "B", v: 2 },
        ],
        (x) => x.k as "A" | "B",
        (x) => x.v,
        ["A", "B"],
      ),
    ).toEqual([{ key: "B", value: 5 }]);
  });
});
