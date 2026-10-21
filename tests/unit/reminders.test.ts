import { describe, expect, it } from "vitest";

import {
  dueReminder,
  reminderTitle,
  shouldCatchUp,
  vnMinutesOfDay,
  watcherDedupKey,
} from "@/lib/reminders";
import { daysLeftInTrash, deletionRoots, isPurgeDue, purgeCutoff } from "@/lib/trash";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`); // ngày thuần (@db.Date)
const vn = (iso: string) => new Date(`${iso}+07:00`); // mốc giờ VN
const at0630 = vn("2026-10-21T06:30:00"); // job sáng 21/10

const task = (due: string) => ({ kind: "task" as const, id: "t1", dueDate: d(due) });

describe("mốc nhắc hạn (Mục 5.4)", () => {
  it("còn 3 ngày và còn 1 ngày thì nhắc; còn 2, 4 ngày hoặc hạn hôm nay thì không", () => {
    expect(dueReminder(task("2026-10-24"), at0630)).toEqual({
      type: "DUE_SOON",
      daysLeft: 3,
      dedupKey: "DUE3:task:t1:2026-10-24",
    });
    expect(dueReminder(task("2026-10-22"), at0630)).toMatchObject({
      type: "DUE_SOON",
      daysLeft: 1,
    });
    for (const due of ["2026-10-23", "2026-10-25", "2026-10-21"])
      expect(dueReminder(task(due), at0630), due).toBeNull();
  });

  it("quá hạn: nhắc mỗi ngày (khoá theo hôm nay), tối đa 7 ngày; ngày đầu đánh dấu firstDay", () => {
    expect(dueReminder(task("2026-10-20"), at0630)).toEqual({
      type: "OVERDUE",
      daysOverdue: 1,
      dedupKey: "OVERDUE:task:t1:2026-10-21",
      firstDay: true,
    });
    expect(dueReminder(task("2026-10-14"), at0630)).toMatchObject({
      daysOverdue: 7,
      firstDay: false,
    });
    expect(dueReminder(task("2026-10-13"), at0630)).toBeNull(); // quá 8 ngày: thôi nhắc
  });

  it("tính theo ngày giờ VN: 23:30 UTC ngày 20 đã là sáng 21 ở VN", () => {
    expect(dueReminder(task("2026-10-24"), new Date("2026-10-20T23:30:00Z"))).toMatchObject({
      daysLeft: 3,
    });
  });

  it("chạy lại trong ngày → cùng khoá (không sinh trùng); gia hạn → khoá mới", () => {
    const morning = dueReminder(task("2026-10-24"), at0630)!;
    const noon = dueReminder(task("2026-10-24"), vn("2026-10-21T12:00:00"))!;
    expect(noon.dedupKey).toBe(morning.dedupKey);
    // gia hạn sang 27/10 → 24/10 sáng nhắc "còn 3 ngày" lại với khoá mới
    expect(dueReminder(task("2026-10-27"), vn("2026-10-24T06:30:00"))!.dedupKey).toBe(
      "DUE3:task:t1:2026-10-27",
    );
    expect(watcherDedupKey("period", "p1", d("2026-10-20"))).toBe(
      "OVERDUE_WATCH:period:p1:2026-10-20",
    );
  });

  it("nội dung thông báo tiếng Việt", () => {
    const soon = dueReminder(task("2026-10-24"), at0630)!;
    const late = dueReminder(task("2026-10-19"), at0630)!;
    const t = { kind: "task" as const, title: "Rà soát hộ nghèo", dueDate: d("2026-10-24") };
    expect(reminderTitle(t, soon)).toBe("Việc “Rà soát hộ nghèo” còn 3 ngày đến hạn (24/10/2026)");
    expect(reminderTitle({ ...t, dueDate: d("2026-10-19") }, late)).toBe(
      "Việc “Rà soát hộ nghèo” đã quá hạn 2 ngày (hạn 19/10/2026)",
    );
    expect(reminderTitle({ ...t, dueDate: d("2026-10-19") }, late, "watcher")).toBe(
      "Việc bạn giao “Rà soát hộ nghèo” đã quá hạn (hạn 19/10/2026)",
    );
    expect(
      reminderTitle(
        {
          kind: "period",
          title: "Báo cáo KT-XH",
          periodLabel: "Tháng 10/2026",
          dueDate: d("2026-10-22"),
        },
        dueReminder({ kind: "period", id: "p", dueDate: d("2026-10-22") }, at0630)!,
      ),
    ).toBe("Báo cáo “Báo cáo KT-XH” — Tháng 10/2026 còn 1 ngày đến hạn (22/10/2026)");
  });
});

describe("lịch chạy job & chạy bù", () => {
  it("giờ VN trong ngày", () => {
    expect(vnMinutesOfDay(at0630)).toBe(390);
    expect(vnMinutesOfDay(new Date("2026-10-20T17:00:00Z"))).toBe(0); // 00:00 ngày 21 giờ VN
  });

  it("job 06:30: chưa chạy hôm nay và đã qua 06:30 → chạy bù; trước 06:30 → chờ lịch", () => {
    expect(shouldCatchUp("2026-10-20", vn("2026-10-21T08:00:00"), { hour: 6, minute: 30 })).toBe(
      true,
    );
    expect(shouldCatchUp(null, vn("2026-10-21T06:29:00"), { hour: 6, minute: 30 })).toBe(false);
    expect(shouldCatchUp("2026-10-21", vn("2026-10-21T08:00:00"), { hour: 6, minute: 30 })).toBe(
      false,
    );
    expect(shouldCatchUp("2026-10-20", vn("2026-10-21T00:05:00"), null)).toBe(true); // job đêm
  });
});

describe("Thùng rác 30 ngày", () => {
  const now = vn("2026-10-21T00:15:00");
  it("xoá vĩnh viễn mục đã ở Thùng rác quá 30 ngày", () => {
    expect(purgeCutoff(now).toISOString()).toBe("2026-09-20T17:15:00.000Z");
    expect(isPurgeDue(vn("2026-09-20T09:00:00"), now)).toBe(true); // 30 ngày 15 giờ
    expect(isPurgeDue(vn("2026-09-21T09:00:00"), now)).toBe(false); // 29 ngày 15 giờ
  });

  it("số ngày còn lại theo ngày VN, không âm", () => {
    expect(daysLeftInTrash(vn("2026-10-21T10:00:00"), vn("2026-10-21T11:00:00"))).toBe(30);
    expect(daysLeftInTrash(vn("2026-09-25T10:00:00"), vn("2026-10-21T11:00:00"))).toBe(4);
    expect(daysLeftInTrash(vn("2026-08-01T10:00:00"), now)).toBe(0);
  });

  it("gốc của mỗi lần xoá: bỏ con xoá cùng lúc với cha, giữ con xoá ở lần khác", () => {
    const t1 = vn("2026-10-01T08:00:00");
    const t2 = vn("2026-10-05T08:00:00");
    const rows = [
      { id: "a", parentId: null, deletedAt: t2 },
      { id: "b", parentId: "a", deletedAt: t2 }, // xoá cùng nhánh a
      { id: "c", parentId: "a", deletedAt: t1 }, // xoá riêng trước đó
      { id: "d", parentId: "x", deletedAt: t1 }, // cha còn sống
    ];
    expect(deletionRoots(rows).map((r) => r.id)).toEqual(["a", "c", "d"]);
  });
});
