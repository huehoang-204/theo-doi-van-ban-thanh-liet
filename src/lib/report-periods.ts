// Sinh kỳ báo cáo (Mục 5.1) — hàm thuần, có unit test. Mọi ngày là ngày thuần (00:00 UTC).
//
//   ONCE       một kỳ, hạn = onceDueDate
//   MONTHLY    mỗi tháng; hạn = ngày `dueDayOfPeriod` của tháng (+ dueMonthOffset tháng)
//   QUARTERLY  mỗi quý; hạn = ngày X của THÁNG CUỐI QUÝ (+ offset)
//   HALF_YEAR  6 tháng đầu/cuối năm; hạn = ngày X của tháng 6 / tháng 12 (+ offset)
//   YEARLY     mỗi năm; hạn = ngày X của tháng 12 (+ offset)
//
// Ngày X lớn hơn số ngày của tháng (VD 31 trong tháng 2) → ngày cuối tháng.
// Kỳ được sinh nếu GIAO với khoảng áp dụng [startDate, endDate].
// Tối đa MAX_PERIODS_PER_DEPARTMENT kỳ cho mỗi đơn vị một lần sinh (D1); job hằng ngày sinh tiếp.

export type ReportFrequency = "ONCE" | "MONTHLY" | "QUARTERLY" | "HALF_YEAR" | "YEARLY";

export const MAX_PERIODS_PER_DEPARTMENT = 24;

export type RequirementRule = {
  frequency: ReportFrequency;
  onceDueDate: Date | null;
  dueDayOfPeriod: number | null;
  dueMonthOffset: number | null;
  startDate: Date;
  endDate: Date | null;
};

export type PeriodSpec = {
  label: string;
  periodStart: Date;
  periodEnd: Date;
  dueDate: Date;
};

const utc = (y: number, m0: number, d: number) => new Date(Date.UTC(y, m0, d));
const daysInMonth = (y: number, m0: number) => new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();
const ROMAN = ["I", "II", "III", "IV"];
const pad = (n: number) => String(n).padStart(2, "0");

/** Ngày `day` của tháng (y, m0 + offset); vượt số ngày của tháng → cuối tháng */
export function dueInMonth(y: number, m0: number, day: number, offset = 0): Date {
  const total = y * 12 + m0 + offset;
  const yy = Math.floor(total / 12);
  const mm = total - yy * 12;
  return utc(yy, mm, Math.min(Math.max(day, 1), daysInMonth(yy, mm)));
}

/** Độ dài kỳ (tháng) theo tần suất */
const SPAN: Record<Exclude<ReportFrequency, "ONCE">, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  HALF_YEAR: 6,
  YEARLY: 12,
};

function labelOf(frequency: Exclude<ReportFrequency, "ONCE">, y: number, m0: number): string {
  switch (frequency) {
    case "MONTHLY":
      return `Tháng ${pad(m0 + 1)}/${y}`;
    case "QUARTERLY":
      return `Quý ${ROMAN[Math.floor(m0 / 3)]}/${y}`;
    case "HALF_YEAR":
      return m0 < 6 ? `6 tháng đầu năm ${y}` : `6 tháng cuối năm ${y}`;
    case "YEARLY":
      return `Năm ${y}`;
  }
}

/**
 * Danh sách kỳ (chưa nhân với đơn vị). `after`: chỉ lấy kỳ bắt đầu SAU ngày này (sinh tiếp);
 * `limit`: số kỳ tối đa.
 */
export function generatePeriods(
  rule: RequirementRule,
  options: { after?: Date | null; limit?: number } = {},
): PeriodSpec[] {
  const limit = options.limit ?? MAX_PERIODS_PER_DEPARTMENT;
  if (rule.endDate && rule.endDate < rule.startDate) return [];

  if (rule.frequency === "ONCE") {
    if (!rule.onceDueDate) return [];
    const spec = {
      label: "Báo cáo một lần",
      periodStart: rule.startDate,
      periodEnd: rule.onceDueDate,
      dueDate: rule.onceDueDate,
    };
    return options.after && spec.periodStart <= options.after ? [] : [spec];
  }

  const span = SPAN[rule.frequency];
  // Không đặt ngày → ngày cuối tháng hạn (31 sẽ được kẹp về cuối tháng)
  const day = rule.dueDayOfPeriod ?? 31;
  const offset = rule.dueMonthOffset ?? 0;
  // Kỳ đầu tiên chứa startDate (căn theo ranh giới tháng/quý/nửa năm/năm dương lịch)
  let y = rule.startDate.getUTCFullYear();
  let m0 = Math.floor(rule.startDate.getUTCMonth() / span) * span;
  const out: PeriodSpec[] = [];
  for (let guard = 0; guard < 1200 && out.length < limit; guard++) {
    const periodStart = utc(y, m0, 1);
    const lastMonth = m0 + span - 1;
    const periodEnd = utc(y, lastMonth, daysInMonth(y, lastMonth));
    if (rule.endDate && periodStart > rule.endDate) break;
    if (!options.after || periodStart > options.after) {
      out.push({
        label: labelOf(rule.frequency, y, m0),
        periodStart,
        periodEnd,
        dueDate: dueInMonth(y, lastMonth, day, offset),
      });
    }
    m0 += span;
    if (m0 >= 12) {
      y += Math.floor(m0 / 12);
      m0 %= 12;
    }
  }
  return out;
}

/** Số kỳ sẽ sinh (xem trước trên form): kỳ × đơn vị */
export function countPeriods(rule: RequirementRule, departmentCount: number): number {
  return generatePeriods(rule).length * departmentCount;
}

/** Mô tả quy tắc hạn bằng lời, VD "ngày 20 hằng tháng", "ngày 15 tháng cuối quý", "ngày 5 tháng sau kỳ" */
export function describeRule(
  rule: Pick<RequirementRule, "frequency" | "dueDayOfPeriod" | "dueMonthOffset" | "onceDueDate">,
): string {
  if (rule.frequency === "ONCE") return "Một lần";
  const day = rule.dueDayOfPeriod ? `ngày ${rule.dueDayOfPeriod}` : "ngày cuối";
  const after = (rule.dueMonthOffset ?? 0) > 0;
  switch (rule.frequency) {
    case "MONTHLY":
      return after ? `Hằng tháng, hạn ${day} tháng sau` : `Hằng tháng, hạn ${day}`;
    case "QUARTERLY":
      return after
        ? `Hằng quý, hạn ${day} tháng đầu quý sau`
        : `Hằng quý, hạn ${day} tháng cuối quý`;
    case "HALF_YEAR":
      return after ? `6 tháng, hạn ${day} tháng sau kỳ` : `6 tháng, hạn ${day} tháng cuối kỳ`;
    case "YEARLY":
      return after ? `Hằng năm, hạn ${day} tháng 1 năm sau` : `Hằng năm, hạn ${day} tháng 12`;
  }
}
