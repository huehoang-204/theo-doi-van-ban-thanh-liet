// Tổng hợp số liệu Bảng điều hành (Mục 7.3) — hàm thuần, có unit test. Truy vấn CSDL ở src/server/dashboard.
import { STATUS_RANK, taskDueStatus, type DueStatus, type TaskFlow } from "@/lib/status";

/** Mật độ dân số (người/km²), làm tròn; null nếu thiếu diện tích */
export function populationDensity(population: number, areaKm2: number): number | null {
  return areaKm2 > 0 ? Math.round(population / areaKm2) : null;
}

/** Số liệu tổ chức đảng: dùng số nhập tay (override) khi có, ngược lại số đếm từ danh mục (Mục 6.4) */
export function withOverride(
  counted: number,
  override: number | null | undefined,
): { value: number; overridden: boolean } {
  return override !== null && override !== undefined
    ? { value: override, overridden: true }
    : { value: counted, overridden: false };
}

// ---------------------------------------------------------------- Công việc

export type DashboardTask = {
  flow: TaskFlow;
  dueDate: Date | null;
  completedAt: Date | null;
  submittedAt: Date | null;
  leadDepartmentId: string | null;
};

export type TaskBuckets = { overdue: number; dueSoon: number; inProgress: number; done: number };

/**
 * 4 thẻ khối ②: Quá hạn / Sắp hạn / Đang làm (chưa đến hạn + không hạn) / Xong (đã duyệt hoàn thành).
 * Việc đã báo hoàn thành chờ duyệt không thuộc thẻ nào (đã xong phần người làm, chưa đóng).
 */
export function taskBuckets(
  tasks: readonly DashboardTask[],
  now: Date,
  dueSoonDays?: number,
): TaskBuckets {
  const out: TaskBuckets = { overdue: 0, dueSoon: 0, inProgress: 0, done: 0 };
  for (const t of tasks) {
    if (t.flow === "CANCELLED") continue;
    if (t.flow === "DONE") {
      out.done++;
      continue;
    }
    if (t.flow === "SUBMITTED") continue;
    const s = taskDueStatus(t, now, dueSoonDays);
    if (s === "QUA_HAN") out.overdue++;
    else if (s === "SAP_DEN_HAN") out.dueSoon++;
    else out.inProgress++;
  }
  return out;
}

/** Việc quá hạn theo đơn vị chủ trì, nhiều nhất trước ("" = chưa giao đơn vị) */
export function overdueByDepartment(
  tasks: readonly DashboardTask[],
  now: Date,
): { departmentId: string; count: number }[] {
  const map = new Map<string, number>();
  for (const t of tasks) {
    if (t.flow !== "NEW" && t.flow !== "IN_PROGRESS") continue;
    if (taskDueStatus(t, now) !== "QUA_HAN") continue;
    const k = t.leadDepartmentId ?? "";
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([departmentId, count]) => ({ departmentId, count }))
    .sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------------- Báo cáo

/** Kỳ báo cáo cần nộp trong N ngày tới (kể cả đã quá hạn), quá hạn lên đầu rồi theo hạn gần nhất */
export function upcomingReports<
  T extends { daysLeft: number; status: DueStatus; submitted: boolean },
>(periods: readonly T[], withinDays = 14): T[] {
  return periods
    .filter((p) => !p.submitted && p.daysLeft <= withinDays)
    .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.daysLeft - b.daysLeft);
}

// ---------------------------------------------------------------- Chương trình

/** Tiến độ các chương trình — thấp nhất trước (Mục 7.2: "xếp theo % tăng dần"); chưa có việc xếp cuối */
export function sortProgramsByProgress<T extends { progress: number | null; title: string }>(
  programs: readonly T[],
): T[] {
  return [...programs].sort((a, b) => {
    if (a.progress === null && b.progress === null) return a.title.localeCompare(b.title, "vi");
    if (a.progress === null) return 1;
    if (b.progress === null) return -1;
    return a.progress - b.progress || a.title.localeCompare(b.title, "vi");
  });
}

// ---------------------------------------------------------------- Nhóm & cộng

/** Đếm theo khoá, giữ thứ tự `order` và bỏ nhóm bằng 0 */
export function countBy<T, K extends string>(
  items: readonly T[],
  key: (t: T) => K,
  order: readonly K[],
): { key: K; count: number }[] {
  const map = new Map<K, number>();
  for (const it of items) map.set(key(it), (map.get(key(it)) ?? 0) + 1);
  return order.map((k) => ({ key: k, count: map.get(k) ?? 0 })).filter((x) => x.count > 0);
}

export function sumBy<T>(items: readonly T[], value: (t: T) => number | null | undefined): number {
  return items.reduce((s, it) => s + (value(it) ?? 0), 0);
}

/** Mốc cập nhật mới nhất của một nhóm bản ghi (cho dòng "Cập nhật ngày …") */
export function latest(dates: ReadonlyArray<Date | null | undefined>): Date | null {
  let max: Date | null = null;
  for (const d of dates) if (d && (!max || d > max)) max = d;
  return max;
}
