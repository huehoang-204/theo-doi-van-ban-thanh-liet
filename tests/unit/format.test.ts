import { describe, expect, it } from "vitest";

import {
  daysUntil,
  formatDate,
  formatDateTime,
  formatDecimal,
  formatLongDate,
  formatNumber,
  formatPopulation,
  formatRelativeDue,
  vnDateKey,
} from "@/lib/format";

// Ngày thuần như Prisma trả về cho cột @db.Date
const dateOnly = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("định dạng số vi-VN", () => {
  it("phân cách nghìn bằng dấu chấm", () => {
    expect(formatNumber(92000)).toBe("92.000");
    expect(formatNumber(4351)).toBe("4.351");
    expect(formatNumber(0)).toBe("0");
  });

  it("thập phân bằng dấu phẩy", () => {
    expect(formatDecimal(6.44)).toBe("6,44");
    expect(formatDecimal(92000 / 6.44, 0)).toBe("14.286");
  });

  it("dân số ước tính có dấu ~", () => {
    expect(formatPopulation(92000, true)).toBe("~92.000");
    expect(formatPopulation(92000, false)).toBe("92.000");
  });
});

describe("định dạng ngày", () => {
  it("ngày thuần không bị lệch múi giờ", () => {
    expect(formatDate(dateOnly("2026-01-12"))).toBe("12/01/2026");
    expect(formatDate(null)).toBe("");
  });

  it("mốc thời gian hiển thị theo giờ Việt Nam", () => {
    // 17:30 UTC = 00:30 ngày hôm sau ở VN
    expect(formatDateTime(new Date("2026-10-19T17:30:00Z"))).toBe("20/10/2026 00:30");
  });

  it("ngày dài có thứ tiếng Việt", () => {
    expect(formatLongDate(new Date("2026-10-20T03:00:00Z"))).toBe("Thứ Ba, 20/10/2026");
  });

  it("ngày hôm nay tính theo giờ VN", () => {
    expect(vnDateKey(new Date("2026-10-20T16:59:00Z"))).toBe("2026-10-20");
    expect(vnDateKey(new Date("2026-10-20T17:00:00Z"))).toBe("2026-10-21");
  });
});

describe("số ngày đến hạn", () => {
  const now = new Date("2026-10-20T02:00:00Z"); // 09:00 ngày 20/10 giờ VN

  it("còn ngày / hôm nay / quá hạn", () => {
    expect(daysUntil(dateOnly("2026-10-23"), now)).toBe(3);
    expect(daysUntil(dateOnly("2026-10-20"), now)).toBe(0);
    expect(daysUntil(dateOnly("2026-10-18"), now)).toBe(-2);
  });

  it("sau 0h giờ VN đã sang ngày mới dù UTC vẫn là hôm trước", () => {
    const lateNight = new Date("2026-10-20T17:30:00Z"); // 00:30 ngày 21/10 giờ VN
    expect(daysUntil(dateOnly("2026-10-20"), lateNight)).toBe(-1);
  });

  it("qua tháng 2 năm nhuận", () => {
    expect(daysUntil(dateOnly("2028-03-01"), new Date("2028-02-28T02:00:00Z"))).toBe(2);
  });

  it("câu chữ tương đối", () => {
    expect(formatRelativeDue(3)).toBe("còn 3 ngày");
    expect(formatRelativeDue(0)).toBe("đến hạn hôm nay");
    expect(formatRelativeDue(-2)).toBe("quá 2 ngày");
  });
});
