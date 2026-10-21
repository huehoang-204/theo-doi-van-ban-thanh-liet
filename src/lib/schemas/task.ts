// Schema công việc (Mục 5.2) — dùng chung form + server action.
import { z } from "zod";

import {
  idField,
  optionalDate,
  optionalId,
  optionalText,
  requiredText,
} from "@/lib/schemas/common";

export const priorityEnum = z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]);

export const PRIORITY_LABELS: Record<z.infer<typeof priorityEnum>, string> = {
  LOW: "Thấp",
  NORMAL: "Bình thường",
  HIGH: "Cao",
  URGENT: "Khẩn",
};

const idArray = z.preprocess(
  (v) => (Array.isArray(v) ? v.filter(Boolean) : []),
  z.array(z.string().min(1)),
);

export const taskSchema = z
  .object({
    id: idField,
    title: requiredText("tiêu đề công việc", 300),
    description: optionalText("mô tả", 5000),
    documentId: optionalId,
    leadDepartmentId: optionalId,
    leadUserId: optionalId,
    coDepartmentIds: idArray,
    coUserIds: idArray,
    startDate: optionalDate("ngày bắt đầu"),
    dueDate: optionalDate("hạn hoàn thành"),
    priority: priorityEnum.default("NORMAL"),
  })
  .superRefine((v, ctx) => {
    if (!v.leadDepartmentId && !v.leadUserId) {
      ctx.addIssue({
        code: "custom",
        path: ["leadDepartmentId"],
        message: "Vui lòng chọn đơn vị hoặc cá nhân chủ trì.",
      });
    }
    if (v.startDate && v.dueDate && v.dueDate < v.startDate) {
      ctx.addIssue({
        code: "custom",
        path: ["dueDate"],
        message: "Hạn hoàn thành không được trước ngày bắt đầu.",
      });
    }
    if (v.leadDepartmentId && v.coDepartmentIds.includes(v.leadDepartmentId)) {
      ctx.addIssue({
        code: "custom",
        path: ["coDepartmentIds"],
        message: "Đơn vị chủ trì không đồng thời là đơn vị phối hợp.",
      });
    }
    if (v.leadUserId && v.coUserIds.includes(v.leadUserId)) {
      ctx.addIssue({
        code: "custom",
        path: ["coUserIds"],
        message: "Người chủ trì không đồng thời là người phối hợp.",
      });
    }
  });

/** Tiến độ 0–100, bước 10 (Mục 5.2) */
export const progressField = z.coerce
  .number({ error: "Tiến độ phải là số." })
  .int()
  .min(0, "Tiến độ từ 0 đến 100%.")
  .max(100, "Tiến độ từ 0 đến 100%.")
  .refine((n) => n % 10 === 0, "Tiến độ theo bước 10%.");

export const progressUpdateSchema = z.object({
  taskId: z.string().min(1),
  progress: progressField,
  content: requiredText("nội dung cập nhật", 2000),
});

export const submitTaskSchema = z.object({
  taskId: z.string().min(1),
  content: requiredText("kết quả thực hiện", 2000),
});

export const approveTaskSchema = z.object({
  taskId: z.string().min(1),
  note: optionalText("ý kiến", 2000),
});

export const returnTaskSchema = z.object({
  taskId: z.string().min(1),
  note: requiredText("lý do trả lại", 2000),
});

export const cancelTaskSchema = z.object({
  taskId: z.string().min(1),
  note: requiredText("lý do huỷ", 2000),
});

export const extensionRequestSchema = z
  .object({
    taskId: z.string().min(1),
    newDueDate: optionalDate("hạn mới"),
    reason: requiredText("lý do gia hạn", 2000),
  })
  .refine((v) => v.newDueDate !== null, {
    path: ["newDueDate"],
    message: "Vui lòng nhập hạn mới.",
  });

export const extensionDecisionSchema = z.object({
  extensionId: z.string().min(1),
  approve: z.boolean(),
  note: optionalText("ý kiến", 2000),
});
