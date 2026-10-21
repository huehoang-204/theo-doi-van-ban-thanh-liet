// Trạng thái theo hạn (Mục 3.3) — dùng thống nhất cho công việc và kỳ báo cáo. Hàm thuần, có unit test.
//
// Trạng thái là giá trị TÍNH TOÁN từ hạn + mốc hoàn thành, không lưu, không sửa tay.
// Hạn tính theo ngày dương lịch, giờ Việt Nam; không trừ ngày nghỉ/lễ ([CẦN XÁC NHẬN] 16.7).
//  - Hạn là ngày thuần (@db.Date, 00:00 UTC).
//  - Hoàn thành vào bất kỳ lúc nào trong ngày hạn (giờ VN) vẫn là đúng hạn.

import { daysUntil, dateOnlyKey, vnDateKey } from "@/lib/format";

export const DEFAULT_DUE_SOON_DAYS = 3;

export type DueStatus =
  "CHUA_DEN_HAN" | "SAP_DEN_HAN" | "QUA_HAN" | "HOAN_THANH" | "HOAN_THANH_TRE" | "KHONG_HAN";

export type Completion =
  /** Mốc thời gian (VD công việc hoàn thành lúc 16:30 ngày 20/10) — so theo ngày giờ VN */
  | { at: Date }
  /** Ngày thuần (VD ngày gửi báo cáo) */
  | { on: Date };

function completionKey(c: Completion): string {
  return "at" in c ? vnDateKey(c.at) : dateOnlyKey(c.on);
}

export function dueStatus(options: {
  dueDate: Date | null;
  completion: Completion | null;
  now?: Date;
  dueSoonDays?: number;
}): DueStatus {
  const { dueDate, completion, now = new Date(), dueSoonDays = DEFAULT_DUE_SOON_DAYS } = options;
  if (completion) {
    if (!dueDate) return "HOAN_THANH";
    return completionKey(completion) <= dateOnlyKey(dueDate) ? "HOAN_THANH" : "HOAN_THANH_TRE";
  }
  if (!dueDate) return "KHONG_HAN";
  const days = daysUntil(dueDate, now);
  if (days < 0) return "QUA_HAN";
  if (days <= dueSoonDays) return "SAP_DEN_HAN";
  return "CHUA_DEN_HAN";
}

/** Số ngày trễ khi đã hoàn thành sau hạn (0 nếu đúng hạn) */
export function lateDays(dueDate: Date, completion: Completion): number {
  const done = Date.parse(`${completionKey(completion)}T00:00:00Z`);
  return Math.max(
    0,
    Math.round((done - Date.parse(`${dateOnlyKey(dueDate)}T00:00:00Z`)) / 86_400_000),
  );
}

export type StatusContext = "task" | "report";

const LABELS: Record<StatusContext, Record<DueStatus, string>> = {
  task: {
    CHUA_DEN_HAN: "Đang thực hiện",
    SAP_DEN_HAN: "Sắp đến hạn",
    QUA_HAN: "Quá hạn",
    HOAN_THANH: "Hoàn thành đúng hạn",
    HOAN_THANH_TRE: "Hoàn thành trễ hạn",
    KHONG_HAN: "Không có hạn",
  },
  // QT-03: Chưa đến hạn / Sắp đến hạn / Quá hạn / Đã nộp đúng hạn / Đã nộp trễ
  report: {
    CHUA_DEN_HAN: "Chưa đến hạn",
    SAP_DEN_HAN: "Sắp đến hạn",
    QUA_HAN: "Quá hạn",
    HOAN_THANH: "Đã nộp đúng hạn",
    HOAN_THANH_TRE: "Đã nộp trễ",
    KHONG_HAN: "Không có hạn",
  },
};

export function statusLabel(status: DueStatus, context: StatusContext = "task"): string {
  return LABELS[context][status];
}

/** Màu & biểu tượng (Mục 3.3) — luôn hiển thị kèm chữ, không chỉ dựa vào màu */
export const STATUS_STYLE: Record<DueStatus, { color: string; icon: string }> = {
  CHUA_DEN_HAN: { color: "#2563EB", icon: "⏳" },
  SAP_DEN_HAN: { color: "#F59E0B", icon: "⚠️" },
  QUA_HAN: { color: "#DC2626", icon: "❗" },
  HOAN_THANH: { color: "#16A34A", icon: "✔" },
  HOAN_THANH_TRE: { color: "#15803D", icon: "✔!" },
  KHONG_HAN: { color: "#6B7280", icon: "—" },
};

export const OPEN_STATUSES: readonly DueStatus[] = [
  "QUA_HAN",
  "SAP_DEN_HAN",
  "CHUA_DEN_HAN",
  "KHONG_HAN",
];

/** Thứ tự ưu tiên khi sắp danh sách việc: quá hạn → sắp hạn → đang làm → không hạn → xong */
export const STATUS_RANK: Record<DueStatus, number> = {
  QUA_HAN: 0,
  SAP_DEN_HAN: 1,
  CHUA_DEN_HAN: 2,
  KHONG_HAN: 3,
  HOAN_THANH_TRE: 4,
  HOAN_THANH: 5,
};

// ---------------------------------------------------------------- Luồng công việc (Mục 5.2)

export type TaskFlow = "NEW" | "IN_PROGRESS" | "SUBMITTED" | "DONE" | "CANCELLED";
export type TaskEvent =
  "UPDATE_PROGRESS" | "SUBMIT" | "APPROVE" | "RETURN" | "REQUEST_EXTENSION" | "CANCEL" | "EDIT";

const ALLOWED: Record<TaskEvent, readonly TaskFlow[]> = {
  UPDATE_PROGRESS: ["NEW", "IN_PROGRESS"],
  SUBMIT: ["NEW", "IN_PROGRESS"],
  APPROVE: ["SUBMITTED"],
  RETURN: ["SUBMITTED"],
  REQUEST_EXTENSION: ["NEW", "IN_PROGRESS"],
  CANCEL: ["NEW", "IN_PROGRESS", "SUBMITTED"],
  EDIT: ["NEW", "IN_PROGRESS", "SUBMITTED"],
};

export const FLOW_LABELS: Record<TaskFlow, string> = {
  NEW: "Mới giao",
  IN_PROGRESS: "Đang thực hiện",
  SUBMITTED: "Chờ duyệt hoàn thành",
  DONE: "Đã hoàn thành",
  CANCELLED: "Đã huỷ",
};

/** null = được phép; ngược lại câu giải thích tiếng Việt */
export function checkTransition(flow: TaskFlow, event: TaskEvent): string | null {
  if (ALLOWED[event].includes(flow)) return null;
  if (flow === "DONE") return "Công việc đã hoàn thành, không thay đổi được nữa.";
  if (flow === "CANCELLED") return "Công việc đã bị huỷ.";
  if (flow === "SUBMITTED")
    return "Công việc đang chờ duyệt hoàn thành — hãy chờ người giao duyệt hoặc trả lại.";
  return "Công việc chưa được báo hoàn thành.";
}

/** Trạng thái theo hạn của một công việc (null = đã huỷ, không tính) */
export function taskDueStatus(
  task: {
    flow: TaskFlow;
    dueDate: Date | null;
    completedAt: Date | null;
    submittedAt: Date | null;
  },
  now?: Date,
  dueSoonDays?: number,
): DueStatus | null {
  if (task.flow === "CANCELLED") return null;
  // Đã báo hoàn thành (chờ duyệt) thì không còn "quá hạn" do chậm duyệt — xét theo lúc báo hoàn thành
  const doneAt =
    task.flow === "DONE"
      ? (task.completedAt ?? task.submittedAt)
      : task.flow === "SUBMITTED"
        ? task.submittedAt
        : null;
  return dueStatus({
    dueDate: task.dueDate,
    completion: doneAt ? { at: doneAt } : null,
    now,
    dueSoonDays,
  });
}
