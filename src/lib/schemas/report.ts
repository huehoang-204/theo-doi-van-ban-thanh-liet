// Schema yêu cầu báo cáo & nộp báo cáo (Mục 5.1).
import { z } from "zod";

import {
  boolField,
  idField,
  optionalDate,
  optionalId,
  optionalInt,
  optionalText,
  requiredText,
} from "@/lib/schemas/common";

export const frequencyEnum = z.enum(["ONCE", "MONTHLY", "QUARTERLY", "HALF_YEAR", "YEARLY"], {
  error: "Vui lòng chọn kiểu báo cáo.",
});

export const FREQUENCY_LABELS: Record<z.infer<typeof frequencyEnum>, string> = {
  ONCE: "Một lần",
  MONTHLY: "Hằng tháng",
  QUARTERLY: "Hằng quý",
  HALF_YEAR: "6 tháng",
  YEARLY: "Hằng năm",
};

const idArray = z.preprocess(
  (v) => (Array.isArray(v) ? v.filter(Boolean) : []),
  z.array(z.string().min(1)),
);

export const requirementSchema = z
  .object({
    id: idField,
    documentId: z.string().min(1, "Thiếu văn bản nguồn."),
    name: requiredText("tên báo cáo", 300),
    frequency: frequencyEnum,
    onceDueDate: optionalDate("hạn nộp"),
    dueDayOfPeriod: optionalInt("ngày hạn trong kỳ", { min: 1, max: 31 }),
    dueMonthOffset: optionalInt("tháng hạn", { max: 12 }).transform((v) => v ?? 0),
    startDate: optionalDate("ngày bắt đầu áp dụng"),
    endDate: optionalDate("ngày kết thúc áp dụng"),
    recipientAgencyId: optionalId,
    departmentIds: idArray.refine(
      (a) => a.length > 0,
      "Vui lòng chọn ít nhất một đơn vị phải báo cáo.",
    ),
    followerUserId: optionalId,
    autoCreateChild: boolField,
    active: boolField,
  })
  .superRefine((v, ctx) => {
    if (!v.startDate)
      ctx.addIssue({
        code: "custom",
        path: ["startDate"],
        message: "Vui lòng nhập ngày bắt đầu áp dụng.",
      });
    if (v.frequency === "ONCE" && !v.onceDueDate) {
      ctx.addIssue({ code: "custom", path: ["onceDueDate"], message: "Vui lòng nhập hạn nộp." });
    }
    if (v.frequency !== "ONCE" && v.dueDayOfPeriod === null) {
      ctx.addIssue({
        code: "custom",
        path: ["dueDayOfPeriod"],
        message: "Vui lòng nhập ngày hạn trong kỳ (1–31).",
      });
    }
    if (v.startDate && v.endDate && v.endDate < v.startDate) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "Ngày kết thúc không được trước ngày bắt đầu.",
      });
    }
    if (v.frequency === "ONCE" && v.startDate && v.onceDueDate && v.onceDueDate < v.startDate) {
      ctx.addIssue({
        code: "custom",
        path: ["onceDueDate"],
        message: "Hạn nộp không được trước ngày bắt đầu áp dụng.",
      });
    }
  });

export const submissionSchema = z
  .object({
    id: idField,
    periodId: z.string().min(1),
    number: optionalText("số, ký hiệu báo cáo", 50),
    sentDate: optionalDate("ngày gửi"),
    note: optionalText("ghi chú", 2000),
  })
  .refine((v) => v.sentDate !== null, {
    path: ["sentDate"],
    message: "Vui lòng nhập ngày gửi báo cáo.",
  });
