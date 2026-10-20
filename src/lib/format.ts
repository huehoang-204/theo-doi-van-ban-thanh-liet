// Định dạng số & ngày kiểu Việt Nam (Mục 7.4, 13.5).
//
// Quy ước ngày:
//  - Trường "chỉ có ngày" (@db.Date: hạn, ngày ban hành…) được Prisma trả về Date lúc 00:00 UTC
//    → đọc theo thành phần UTC, KHÔNG đổi múi giờ (tránh lệch 1 ngày).
//  - Mốc thời gian (createdAt, completedAt…) hiển thị theo giờ Việt Nam.

import { vi } from "@/lib/i18n/vi";

export const VN_TIME_ZONE = "Asia/Ho_Chi_Minh";

const integerFormat = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 });

/** 92000 → "92.000" */
export function formatNumber(value: number): string {
  return integerFormat.format(value);
}

/** 6.44 → "6,44" */
export function formatDecimal(value: number, maxFractionDigits = 2): string {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: maxFractionDigits }).format(value);
}

/** Dân số: "~92.000" khi là số ước tính */
export function formatPopulation(value: number, isEstimate: boolean): string {
  return `${isEstimate ? "~" : ""}${formatNumber(value)}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Ngày thuần (@db.Date) → "dd/mm/yyyy" */
export function formatDate(date: Date | null | undefined): string {
  if (!date) return "";
  return `${pad2(date.getUTCDate())}/${pad2(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}`;
}

const vnDateTimeParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: VN_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function vnParts(date: Date) {
  const parts = Object.fromEntries(
    vnDateTimeParts.formatToParts(date).map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  return {
    year: parts.year ?? "",
    month: parts.month ?? "",
    day: parts.day ?? "",
    hour: parts.hour ?? "",
    minute: parts.minute ?? "",
  };
}

/** Mốc thời gian → "dd/mm/yyyy HH:mm" theo giờ Việt Nam */
export function formatDateTime(date: Date | null | undefined): string {
  if (!date) return "";
  const p = vnParts(date);
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

const longDateFormat = new Intl.DateTimeFormat("vi-VN", {
  timeZone: VN_TIME_ZONE,
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** "Thứ Ba, 20/10/2026" theo giờ Việt Nam */
export function formatLongDate(date: Date): string {
  return longDateFormat.format(date);
}

/** Ngày hôm nay (giờ VN) dạng "YYYY-MM-DD" */
export function vnDateKey(now: Date): string {
  const p = vnParts(now);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Ngày thuần (@db.Date) dạng "YYYY-MM-DD" */
export function dateOnlyKey(date: Date): string {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

const MS_PER_DAY = 86_400_000;

/** Số ngày từ hôm nay (giờ VN) đến hạn: dương = còn, 0 = hôm nay, âm = quá hạn */
export function daysUntil(dueDate: Date, now: Date = new Date()): number {
  const today = Date.parse(`${vnDateKey(now)}T00:00:00Z`);
  const due = Date.parse(`${dateOnlyKey(dueDate)}T00:00:00Z`);
  return Math.round((due - today) / MS_PER_DAY);
}

/** "còn 3 ngày" / "đến hạn hôm nay" / "quá 2 ngày" */
export function formatRelativeDue(days: number): string {
  if (days === 0) return vi.format.dueToday;
  return days > 0 ? vi.format.daysLeft(days) : vi.format.daysOverdue(-days);
}
