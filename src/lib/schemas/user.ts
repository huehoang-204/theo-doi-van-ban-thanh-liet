import { z } from "zod";

import { passwordSchema } from "@/lib/password";
import {
  boolField,
  idField,
  optionalEmail,
  optionalId,
  optionalPhone,
  optionalText,
  requiredText,
} from "@/lib/schemas/common";

export const roleEnum = z.enum(["ADMIN", "LEADER", "CLERK", "OFFICER", "PARTY_ADMIN", "VIEWER"]);

const userFields = {
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Vui lòng nhập tên đăng nhập.")
    .min(3, "Tên đăng nhập phải có ít nhất 3 ký tự.")
    .max(32, "Tên đăng nhập tối đa 32 ký tự.")
    .regex(/^[a-z0-9._]+$/, "Tên đăng nhập chỉ gồm chữ không dấu, số, dấu chấm và gạch dưới."),
  fullName: requiredText("họ và tên", 100),
  position: optionalText("chức vụ", 100),
  phone: optionalPhone(),
  email: optionalEmail(),
  departmentId: optionalId,
  roles: z.array(roleEnum).min(1, "Vui lòng chọn ít nhất một vai trò."),
  active: boolField,
};

export const createUserSchema = z.object({ ...userFields, password: passwordSchema });
export const updateUserSchema = z.object({ id: z.string().min(1), ...userFields });
export const userFormSchema = z.object({
  id: idField,
  ...userFields,
  password: z.string().optional(),
});
