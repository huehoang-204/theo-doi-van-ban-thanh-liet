// Ban hành văn bản & thảo luận (GĐ5b) — dùng chung form và server action.
import { z } from "zod";

import { hasRecipients } from "@/lib/publish";

export const MAX_COMMENT_LENGTH = 4000;

export const publishDocumentSchema = z
  .object({
    id: z.string().min(1),
    all: z.boolean(),
    departmentIds: z.array(z.string().min(1)).max(100),
    userIds: z.array(z.string().min(1)).max(500),
    message: z
      .string()
      .trim()
      .max(4000, "Lời gửi kèm tối đa 4.000 ký tự.")
      .transform((v) => v || null),
  })
  .refine(hasRecipients, {
    message: "Hãy chọn người nhận: Toàn phường, ít nhất một đơn vị hoặc một người.",
    path: ["recipients"],
  });

export const commentSchema = z.object({
  documentId: z.string().min(1),
  content: z
    .string()
    .trim()
    .min(1, "Hãy nhập nội dung thảo luận.")
    .max(
      MAX_COMMENT_LENGTH,
      `Nội dung tối đa ${MAX_COMMENT_LENGTH.toLocaleString("vi-VN")} ký tự.`,
    ),
});
