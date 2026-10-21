// Tiến độ cộng dồn của cây (Mục 3.4) — hàm thuần, có unit test.
//
// Tiến độ một văn bản = trung bình của:
//   • tiến độ từng công việc gắn TRỰC TIẾP (bỏ việc đã huỷ; việc đã hoàn thành = 100%)
//   • tiến độ từng văn bản con CÓ tiến độ (đệ quy)
// Văn bản con không có việc nào trong cả nhánh thì KHÔNG tính (D2 — tránh kéo tiến độ về 0
// vì Quy chế, Phụ lục… vốn không giao việc). Không có gì để tính → null ("—").
//
// Chấm đỏ: văn bản có việc quá hạn ở chính nó hoặc bất kỳ con cháu nào.

import { taskDueStatus, type TaskFlow } from "@/lib/status";

export type RollupNode = { id: string; parentId: string | null };
export type RollupTask = {
  documentId: string | null;
  progress: number;
  flow: TaskFlow;
  dueDate: Date | null;
  completedAt: Date | null;
  submittedAt: Date | null;
};

export type RollupResult = { progress: number | null; hasOverdue: boolean };

export function rollUpProgress(
  nodes: readonly RollupNode[],
  tasks: readonly RollupTask[],
  now: Date = new Date(),
  dueSoonDays?: number,
): Map<string, RollupResult> {
  const children = new Map<string, string[]>();
  for (const n of nodes) {
    if (n.parentId) children.set(n.parentId, [...(children.get(n.parentId) ?? []), n.id]);
  }
  const ownTasks = new Map<string, RollupTask[]>();
  for (const t of tasks) {
    if (!t.documentId || t.flow === "CANCELLED") continue;
    ownTasks.set(t.documentId, [...(ownTasks.get(t.documentId) ?? []), t]);
  }

  const result = new Map<string, RollupResult>();
  const visit = (id: string, guard: Set<string>): RollupResult => {
    const cached = result.get(id);
    if (cached) return cached;
    if (guard.has(id)) return { progress: null, hasOverdue: false }; // phòng dữ liệu vòng lặp
    guard.add(id);
    const values: number[] = [];
    let hasOverdue = false;
    for (const t of ownTasks.get(id) ?? []) {
      values.push(t.flow === "DONE" ? 100 : Math.max(0, Math.min(100, t.progress)));
      if (taskDueStatus(t, now, dueSoonDays) === "QUA_HAN") hasOverdue = true;
    }
    for (const c of children.get(id) ?? []) {
      const r = visit(c, guard);
      if (r.progress !== null) values.push(r.progress);
      if (r.hasOverdue) hasOverdue = true;
    }
    const progress = values.length
      ? Math.round(values.reduce((s, v) => s + v, 0) / values.length)
      : null;
    const r = { progress, hasOverdue };
    result.set(id, r);
    return r;
  };
  for (const n of nodes) visit(n.id, new Set());
  return result;
}
