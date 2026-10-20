import { z } from "zod";

import { passwordSchema } from "@/lib/password";

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Vui lòng nhập mật khẩu hiện tại."),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "Vui lòng nhập lại mật khẩu mới."),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Mật khẩu nhập lại không khớp.",
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ["newPassword"],
    message: "Mật khẩu mới phải khác mật khẩu hiện tại.",
  });

export type ChangePasswordInput = z.input<typeof changePasswordSchema>;
