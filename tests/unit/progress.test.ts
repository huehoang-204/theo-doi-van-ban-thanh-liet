import { describe, expect, it } from "vitest";

import { rollUpProgress, type RollupNode, type RollupTask } from "@/lib/progress";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const now = new Date("2026-10-20T02:00:00Z");

const nodes: RollupNode[] = [
  { id: "CT", parentId: null },
  { id: "KH", parentId: "CT" },
  { id: "QD", parentId: "KH" },
  { id: "QC", parentId: "QD" }, // không có việc
  { id: "KH2", parentId: "CT" },
];
const task = (
  documentId: string,
  progress: number,
  over: Partial<RollupTask> = {},
): RollupTask => ({
  documentId,
  progress,
  flow: "IN_PROGRESS",
  dueDate: d("2026-12-31"),
  completedAt: null,
  submittedAt: null,
  ...over,
});

describe("tiến độ cộng dồn (Mục 3.4)", () => {
  it("trung bình việc trực tiếp + văn bản con có tiến độ; nhánh không có việc không kéo tiến độ xuống", () => {
    const r = rollUpProgress(
      nodes,
      [
        task("QD", 40),
        task("QD", 80),
        task("KH", 100, { flow: "DONE", completedAt: d("2026-10-01") }),
        task("KH2", 30),
      ],
      now,
    );
    expect(r.get("QC")).toEqual({ progress: null, hasOverdue: false });
    expect(r.get("QD")!.progress).toBe(60); // (40 + 80) / 2, QC không tính
    expect(r.get("KH")!.progress).toBe(80); // (100 + 60) / 2
    expect(r.get("CT")!.progress).toBe(55); // (80 + 30) / 2
  });

  it("việc huỷ không tính; việc đã duyệt tính 100%", () => {
    const r = rollUpProgress(
      nodes,
      [
        task("KH2", 20, { flow: "CANCELLED" }),
        task("KH2", 50, { flow: "DONE", completedAt: d("2026-10-01") }),
      ],
      now,
    );
    expect(r.get("KH2")!.progress).toBe(100);
  });

  it("chấm đỏ: việc quá hạn ở nút hoặc con cháu làm cả nhánh có chấm đỏ", () => {
    const r = rollUpProgress(
      nodes,
      [task("QD", 10, { dueDate: d("2026-10-19") }), task("KH2", 10)],
      now,
    );
    expect(["CT", "KH", "QD"].map((id) => r.get(id)!.hasOverdue)).toEqual([true, true, true]);
    expect(r.get("QC")!.hasOverdue).toBe(false);
    expect(r.get("KH2")!.hasOverdue).toBe(false);
  });

  it("việc đã báo hoàn thành đúng hạn (chờ duyệt) không làm chấm đỏ", () => {
    const r = rollUpProgress(
      nodes,
      [
        task("QD", 100, {
          flow: "SUBMITTED",
          dueDate: d("2026-10-19"),
          submittedAt: d("2026-10-18"),
        }),
      ],
      now,
    );
    expect(r.get("CT")!.hasOverdue).toBe(false);
  });

  it("không có việc nào → null", () => {
    expect(rollUpProgress(nodes, [], now).get("CT")).toEqual({ progress: null, hasOverdue: false });
  });
});
