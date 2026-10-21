import { describe, expect, it } from "vitest";

import { checkTransition, dueStatus, lateDays, statusLabel, taskDueStatus } from "@/lib/status";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`); // ngày thuần như cột @db.Date
const vn = (iso: string) => new Date(`${iso}+07:00`); // mốc thời gian giờ Việt Nam

describe("trạng thái theo hạn (Mục 3.3) — múi giờ Asia/Ho_Chi_Minh", () => {
  const now = vn("2026-10-20T09:00:00");

  it("hạn đúng hôm nay → Sắp đến hạn (chưa quá hạn)", () => {
    expect(dueStatus({ dueDate: d("2026-10-20"), completion: null, now })).toBe("SAP_DEN_HAN");
    // 23:59 cùng ngày vẫn chưa quá hạn
    expect(
      dueStatus({ dueDate: d("2026-10-20"), completion: null, now: vn("2026-10-20T23:59:00") }),
    ).toBe("SAP_DEN_HAN");
  });

  it("quá 1 ngày → Quá hạn; sang 00:00 giờ VN là quá hạn dù giờ UTC vẫn là hôm trước", () => {
    expect(dueStatus({ dueDate: d("2026-10-19"), completion: null, now })).toBe("QUA_HAN");
    // 00:30 ngày 21/10 giờ VN = 17:30 ngày 20/10 UTC
    expect(
      dueStatus({ dueDate: d("2026-10-20"), completion: null, now: vn("2026-10-21T00:30:00") }),
    ).toBe("QUA_HAN");
  });

  it("còn ≤ N ngày → Sắp đến hạn; còn > N ngày → Đang thực hiện; N cấu hình được", () => {
    expect(dueStatus({ dueDate: d("2026-10-23"), completion: null, now })).toBe("SAP_DEN_HAN");
    expect(dueStatus({ dueDate: d("2026-10-24"), completion: null, now })).toBe("CHUA_DEN_HAN");
    expect(dueStatus({ dueDate: d("2026-10-24"), completion: null, now, dueSoonDays: 5 })).toBe(
      "SAP_DEN_HAN",
    );
  });

  it("không đặt hạn", () => {
    expect(dueStatus({ dueDate: null, completion: null, now })).toBe("KHONG_HAN");
    expect(dueStatus({ dueDate: null, completion: { at: now }, now })).toBe("HOAN_THANH");
  });

  it("hoàn thành trong ngày hạn (kể cả 23:59 giờ VN) là đúng hạn; sau đó là trễ", () => {
    expect(
      dueStatus({ dueDate: d("2026-10-20"), completion: { at: vn("2026-10-20T23:59:00") } }),
    ).toBe("HOAN_THANH");
    expect(
      dueStatus({ dueDate: d("2026-10-20"), completion: { at: vn("2026-10-21T00:01:00") } }),
    ).toBe("HOAN_THANH_TRE");
  });

  it("báo cáo: nộp ngày 21 cho hạn ngày 20 → Đã nộp trễ (tiêu chí nghiệm thu GĐ3)", () => {
    const status = dueStatus({ dueDate: d("2026-01-20"), completion: { on: d("2026-01-21") } });
    expect(status).toBe("HOAN_THANH_TRE");
    expect(statusLabel(status, "report")).toBe("Đã nộp trễ");
    expect(
      statusLabel(
        dueStatus({ dueDate: d("2026-01-20"), completion: { on: d("2026-01-20") } }),
        "report",
      ),
    ).toBe("Đã nộp đúng hạn");
    expect(lateDays(d("2026-01-20"), { on: d("2026-01-21") })).toBe(1);
  });

  it("qua tháng 2 năm nhuận: hạn 01/03/2028, hôm nay 28/02 → còn 2 ngày", () => {
    expect(
      dueStatus({ dueDate: d("2028-03-01"), completion: null, now: vn("2028-02-28T08:00:00") }),
    ).toBe("SAP_DEN_HAN");
    expect(
      dueStatus({ dueDate: d("2028-02-29"), completion: null, now: vn("2028-03-01T08:00:00") }),
    ).toBe("QUA_HAN");
  });

  it("nhãn theo ngữ cảnh công việc / báo cáo", () => {
    expect(statusLabel("CHUA_DEN_HAN")).toBe("Đang thực hiện");
    expect(statusLabel("CHUA_DEN_HAN", "report")).toBe("Chưa đến hạn");
    expect(statusLabel("HOAN_THANH_TRE")).toBe("Hoàn thành trễ hạn");
  });
});

describe("công việc: trạng thái theo luồng xử lý", () => {
  const base = { dueDate: d("2026-10-15"), completedAt: null, submittedAt: null };
  const now = vn("2026-10-20T09:00:00");

  it("đã báo hoàn thành đúng hạn thì không thành quá hạn vì chờ duyệt", () => {
    expect(
      taskDueStatus({ ...base, flow: "SUBMITTED", submittedAt: vn("2026-10-14T10:00:00") }, now),
    ).toBe("HOAN_THANH");
    expect(taskDueStatus({ ...base, flow: "IN_PROGRESS" }, now)).toBe("QUA_HAN");
  });

  it("đã duyệt: lấy mốc hoàn thành; việc huỷ không tính", () => {
    expect(
      taskDueStatus({ ...base, flow: "DONE", completedAt: vn("2026-10-16T08:00:00") }, now),
    ).toBe("HOAN_THANH_TRE");
    expect(taskDueStatus({ ...base, flow: "CANCELLED" }, now)).toBeNull();
  });

  it("chuyển trạng thái hợp lệ / không hợp lệ", () => {
    expect(checkTransition("IN_PROGRESS", "SUBMIT")).toBeNull();
    expect(checkTransition("SUBMITTED", "APPROVE")).toBeNull();
    expect(checkTransition("SUBMITTED", "RETURN")).toBeNull();
    expect(checkTransition("IN_PROGRESS", "APPROVE")).toBe("Công việc chưa được báo hoàn thành.");
    expect(checkTransition("DONE", "UPDATE_PROGRESS")).toBe(
      "Công việc đã hoàn thành, không thay đổi được nữa.",
    );
    expect(checkTransition("SUBMITTED", "UPDATE_PROGRESS")).toMatch(/đang chờ duyệt/);
    expect(checkTransition("CANCELLED", "REQUEST_EXTENSION")).toBe("Công việc đã bị huỷ.");
  });
});
