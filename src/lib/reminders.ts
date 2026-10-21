// Nhắc hạn (Mục 5.4) — hàm thuần, có unit test. Job 06:30 ở src/server/jobs/daily.ts gọi các hàm này.
//
// - Còn 3 ngày, còn 1 ngày: nhắc một lần cho mỗi mốc (khoá chống trùng theo ngày hạn → gia hạn thì nhắc lại).
// - Quá hạn: nhắc 1 lần/ngày, tối đa 7 ngày. Ngày quá hạn đầu tiên báo thêm người giao việc / người theo dõi báo cáo.
// - Việc đã báo hoàn thành (chờ duyệt), đã xong, đã huỷ; kỳ báo cáo đã nộp: không nhắc.
import { dateOnlyKey, daysUntil, formatDate, VN_TIME_ZONE, vnDateKey } from "@/lib/format";

export const DUE_REMINDER_DAYS: readonly number[] = [3, 1];
export const OVERDUE_REMINDER_MAX_DAYS = 7;
/** Giờ chạy job nhắc hạn hằng ngày (giờ VN) */
export const DAILY_JOB_AT = { hour: 6, minute: 30 } as const;

export type ReminderSubjectKind = "task" | "period";

export type Reminder =
  | { type: "DUE_SOON"; daysLeft: number; dedupKey: string }
  | { type: "OVERDUE"; daysOverdue: number; dedupKey: string; firstDay: boolean };

/** Mốc nhắc của hôm nay cho một việc/kỳ báo cáo còn mở (null = hôm nay không nhắc) */
export function dueReminder(
  subject: { kind: ReminderSubjectKind; id: string; dueDate: Date },
  now: Date,
): Reminder | null {
  const days = daysUntil(subject.dueDate, now);
  const base = `${subject.kind}:${subject.id}`;
  if (DUE_REMINDER_DAYS.includes(days)) {
    return {
      type: "DUE_SOON",
      daysLeft: days,
      dedupKey: `DUE${days}:${base}:${dateOnlyKey(subject.dueDate)}`,
    };
  }
  if (days < 0 && -days <= OVERDUE_REMINDER_MAX_DAYS) {
    return {
      type: "OVERDUE",
      daysOverdue: -days,
      dedupKey: `OVERDUE:${base}:${vnDateKey(now)}`,
      firstDay: days === -1,
    };
  }
  return null;
}

/** Khoá chống trùng cho thông báo "quá hạn" gửi người giao việc / người theo dõi (một lần mỗi hạn) */
export function watcherDedupKey(kind: ReminderSubjectKind, id: string, dueDate: Date): string {
  return `OVERDUE_WATCH:${kind}:${id}:${dateOnlyKey(dueDate)}`;
}

/** Nội dung thông báo nhắc hạn */
export function reminderTitle(
  subject: { kind: ReminderSubjectKind; title: string; dueDate: Date; periodLabel?: string },
  reminder: Reminder,
  audience: "doer" | "watcher" = "doer",
): string {
  const what =
    subject.kind === "task"
      ? `${audience === "watcher" ? "Việc bạn giao" : "Việc"} “${subject.title}”`
      : `Báo cáo “${subject.title}”${subject.periodLabel ? ` — ${subject.periodLabel}` : ""}`;
  const due = formatDate(subject.dueDate);
  if (reminder.type === "DUE_SOON") return `${what} còn ${reminder.daysLeft} ngày đến hạn (${due})`;
  if (audience === "watcher") return `${what} đã quá hạn (hạn ${due})`;
  return `${what} đã quá hạn ${reminder.daysOverdue} ngày (hạn ${due})`;
}

// ---------------------------------------------------------------- Lịch chạy job

/** Số phút từ 00:00 theo giờ VN */
export function vnMinutesOfDay(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: VN_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return get("hour") * 60 + get("minute");
}

/**
 * Worker khởi động lại sau giờ chạy (máy tắt lúc 06:30…) → chạy bù ngay nếu hôm nay chưa chạy.
 * `at` = null: chạy bù bất kỳ lúc nào trong ngày (job đêm).
 */
export function shouldCatchUp(
  lastRunDay: string | null,
  now: Date,
  at: { hour: number; minute: number } | null,
): boolean {
  if (lastRunDay === vnDateKey(now)) return false;
  return at === null || vnMinutesOfDay(now) >= at.hour * 60 + at.minute;
}
