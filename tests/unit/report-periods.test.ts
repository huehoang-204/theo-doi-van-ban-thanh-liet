import { describe, expect, it } from "vitest";

import {
  countPeriods,
  describeRule,
  dueInMonth,
  generatePeriods,
  type RequirementRule,
} from "@/lib/report-periods";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const key = (x: Date) => x.toISOString().slice(0, 10);
const rule = (over: Partial<RequirementRule>): RequirementRule => ({
  frequency: "MONTHLY",
  onceDueDate: null,
  dueDayOfPeriod: 20,
  dueMonthOffset: 0,
  startDate: d("2026-01-01"),
  endDate: d("2026-12-31"),
  ...over,
});

describe("sinh kỳ báo cáo (Mục 5.1)", () => {
  it("nghiệm thu GĐ3: hằng tháng ngày 20, 01/2026–12/2026, 3 đơn vị → 36 kỳ", () => {
    const periods = generatePeriods(rule({}));
    expect(periods).toHaveLength(12);
    expect(countPeriods(rule({}), 3)).toBe(36);
    expect(periods[0]).toEqual({
      label: "Tháng 01/2026",
      periodStart: d("2026-01-01"),
      periodEnd: d("2026-01-31"),
      dueDate: d("2026-01-20"),
    });
    expect(periods.map((p) => key(p.dueDate))).toEqual([
      "2026-01-20",
      "2026-02-20",
      "2026-03-20",
      "2026-04-20",
      "2026-05-20",
      "2026-06-20",
      "2026-07-20",
      "2026-08-20",
      "2026-09-20",
      "2026-10-20",
      "2026-11-20",
      "2026-12-20",
    ]);
  });

  it("tháng 2: ngày 30/31 lùi về cuối tháng; năm nhuận 2028 → 29/02", () => {
    const p2026 = generatePeriods(rule({ dueDayOfPeriod: 31 }));
    expect(key(p2026[1]!.dueDate)).toBe("2026-02-28");
    expect(key(p2026[3]!.dueDate)).toBe("2026-04-30");
    const p2028 = generatePeriods(
      rule({ dueDayOfPeriod: 30, startDate: d("2028-01-01"), endDate: d("2028-03-31") }),
    );
    expect(p2028.map((p) => key(p.dueDate))).toEqual(["2028-01-30", "2028-02-29", "2028-03-30"]);
    expect(p2028[1]!.periodEnd).toEqual(d("2028-02-29"));
  });

  it("cuối quý: hạn ngày 15 tháng cuối quý; ngày 31 ở quý II → 30/06", () => {
    const q = generatePeriods(rule({ frequency: "QUARTERLY", dueDayOfPeriod: 15 }));
    expect(q.map((p) => [p.label, key(p.periodStart), key(p.periodEnd), key(p.dueDate)])).toEqual([
      ["Quý I/2026", "2026-01-01", "2026-03-31", "2026-03-15"],
      ["Quý II/2026", "2026-04-01", "2026-06-30", "2026-06-15"],
      ["Quý III/2026", "2026-07-01", "2026-09-30", "2026-09-15"],
      ["Quý IV/2026", "2026-10-01", "2026-12-31", "2026-12-15"],
    ]);
    expect(
      key(generatePeriods(rule({ frequency: "QUARTERLY", dueDayOfPeriod: 31 }))[1]!.dueDate),
    ).toBe("2026-06-30");
  });

  it("6 tháng: hai kỳ, hạn trong tháng 6 và tháng 12", () => {
    const h = generatePeriods(
      rule({ frequency: "HALF_YEAR", dueDayOfPeriod: 10, endDate: d("2027-12-31") }),
    );
    expect(h.map((p) => [p.label, key(p.dueDate)])).toEqual([
      ["6 tháng đầu năm 2026", "2026-06-10"],
      ["6 tháng cuối năm 2026", "2026-12-10"],
      ["6 tháng đầu năm 2027", "2027-06-10"],
      ["6 tháng cuối năm 2027", "2027-12-10"],
    ]);
  });

  it("báo cáo nộp vào tháng sau kỳ (ngày 5 tháng sau): kỳ tháng 12 hạn 05/01 năm sau", () => {
    const m = generatePeriods(rule({ dueDayOfPeriod: 5, dueMonthOffset: 1 }));
    expect(key(m[0]!.dueDate)).toBe("2026-02-05");
    expect(m[11]!.label).toBe("Tháng 12/2026");
    expect(key(m[11]!.dueDate)).toBe("2027-01-05");
    const y = generatePeriods(
      rule({
        frequency: "YEARLY",
        dueDayOfPeriod: 15,
        dueMonthOffset: 1,
        endDate: d("2027-12-31"),
      }),
    );
    expect(y.map((p) => [p.label, key(p.dueDate)])).toEqual([
      ["Năm 2026", "2027-01-15"],
      ["Năm 2027", "2028-01-15"],
    ]);
    // Quý IV nộp tháng đầu quý sau, ngày 31 → 31/01
    expect(
      key(
        generatePeriods(rule({ frequency: "QUARTERLY", dueDayOfPeriod: 31, dueMonthOffset: 1 }))[3]!
          .dueDate,
      ),
    ).toBe("2027-01-31");
  });

  it("bắt đầu giữa kỳ: kỳ chứa ngày bắt đầu vẫn được sinh (căn theo tháng/quý dương lịch)", () => {
    const m = generatePeriods(rule({ startDate: d("2026-10-15"), endDate: d("2027-02-10") }));
    expect(m.map((p) => p.label)).toEqual([
      "Tháng 10/2026",
      "Tháng 11/2026",
      "Tháng 12/2026",
      "Tháng 01/2027",
      "Tháng 02/2027",
    ]);
    const q = generatePeriods(
      rule({ frequency: "QUARTERLY", startDate: d("2026-05-20"), endDate: d("2026-08-01") }),
    );
    expect(q.map((p) => p.label)).toEqual(["Quý II/2026", "Quý III/2026"]);
  });

  it("một lần: một kỳ, hạn đúng ngày đặt", () => {
    expect(generatePeriods(rule({ frequency: "ONCE", onceDueDate: d("2026-11-30") }))).toEqual([
      {
        label: "Báo cáo một lần",
        periodStart: d("2026-01-01"),
        periodEnd: d("2026-11-30"),
        dueDate: d("2026-11-30"),
      },
    ]);
    expect(generatePeriods(rule({ frequency: "ONCE", onceDueDate: null }))).toEqual([]);
  });

  it("không có ngày kết thúc: tối đa 24 kỳ/đơn vị; sinh tiếp sau kỳ cuối", () => {
    const first = generatePeriods(rule({ endDate: null }));
    expect(first).toHaveLength(24);
    expect(first.at(-1)!.label).toBe("Tháng 12/2027");
    const next = generatePeriods(rule({ endDate: null }), {
      after: first.at(-1)!.periodStart,
      limit: 3,
    });
    expect(next.map((p) => p.label)).toEqual(["Tháng 01/2028", "Tháng 02/2028", "Tháng 03/2028"]);
  });

  it("không đặt ngày → ngày cuối của từng tháng; khoảng áp dụng ngược → không sinh", () => {
    expect(
      generatePeriods(rule({ dueDayOfPeriod: null }))
        .slice(0, 2)
        .map((p) => key(p.dueDate)),
    ).toEqual(["2026-01-31", "2026-02-28"]);
    expect(generatePeriods(rule({ startDate: d("2026-12-01"), endDate: d("2026-01-01") }))).toEqual(
      [],
    );
  });

  it("tính hạn tháng: chuyển năm, kẹp cuối tháng", () => {
    expect(key(dueInMonth(2026, 11, 31, 2))).toBe("2027-02-28");
  });

  it("mô tả quy tắc bằng lời", () => {
    expect(
      describeRule({
        frequency: "MONTHLY",
        dueDayOfPeriod: 20,
        dueMonthOffset: 0,
        onceDueDate: null,
      }),
    ).toBe("Hằng tháng, hạn ngày 20");
    expect(
      describeRule({
        frequency: "QUARTERLY",
        dueDayOfPeriod: 15,
        dueMonthOffset: 0,
        onceDueDate: null,
      }),
    ).toBe("Hằng quý, hạn ngày 15 tháng cuối quý");
    expect(
      describeRule({
        frequency: "MONTHLY",
        dueDayOfPeriod: 5,
        dueMonthOffset: 1,
        onceDueDate: null,
      }),
    ).toBe("Hằng tháng, hạn ngày 5 tháng sau");
  });
});
