// Schema văn bản — Mục 4.3 (thể thức theo Nghị định 30/2020/NĐ-CP). Dùng chung form + server action.
import { z } from "zod";

import {
  boolField,
  idField,
  optionalDate,
  optionalId,
  optionalText,
  requiredText,
} from "@/lib/schemas/common";

export const urgencyEnum = z.enum(["NORMAL", "URGENT", "VERY_URGENT", "FLASH"]);
export const validityEnum = z.enum(["ACTIVE", "EXPIRED", "REPLACED"]);

export const MAX_SUMMARY_LENGTH = 20_000;

/** "chuyển đổi số, TTHC" → ["chuyển đổi số", "TTHC"] (bỏ trùng, bỏ rỗng) */
export function parseTags(value: unknown): string[] {
  const list = Array.isArray(value) ? value : String(value ?? "").split(/[,;\n]/);
  return [...new Set(list.map((t) => String(t).trim()).filter(Boolean))].slice(0, 20);
}

const tagsField = z.preprocess(
  parseTags,
  z.array(z.string().max(50, "Mỗi thẻ tối đa 50 ký tự.")).max(20, "Tối đa 20 thẻ."),
);

const idArray = z.preprocess(
  (v) => (Array.isArray(v) ? v.filter(Boolean) : []),
  z.array(z.string().min(1)),
);

export const documentFields = z.object({
  typeId: z.string({ error: "Vui lòng chọn loại văn bản." }).min(1, "Vui lòng chọn loại văn bản."),
  number: optionalText("số, ký hiệu", 50),
  title: requiredText("trích yếu văn bản", 500),
  issuingAgencyId: optionalId,
  issuingAgencyText: optionalText("cơ quan ban hành", 200),
  signer: optionalText("người ký", 100),
  issuedDate: optionalDate("ngày ban hành"),
  effectiveDate: optionalDate("ngày hiệu lực"),
  dueDate: optionalDate("hạn xử lý"),
  fieldId: optionalId,
  urgency: urgencyEnum.default("NORMAL"),
  validity: validityEnum.default("ACTIVE"),
  replacedById: optionalId,
  leadDepartmentId: optionalId,
  coDepartmentIds: idArray,
  summary: optionalText("nội dung tóm tắt", MAX_SUMMARY_LENGTH),
  tags: tagsField,
  isInternalPublic: boolField,
});

type DocumentFieldsOut = z.output<typeof documentFields>;

/** Ràng buộc chéo giữa các trường */
function crossCheck(v: DocumentFieldsOut, ctx: z.RefinementCtx) {
  if (!v.issuingAgencyId && !v.issuingAgencyText) {
    ctx.addIssue({
      code: "custom",
      path: ["issuingAgencyId"],
      message: "Vui lòng chọn hoặc nhập cơ quan ban hành.",
    });
  }
  if (!v.issuedDate) {
    ctx.addIssue({ code: "custom", path: ["issuedDate"], message: "Vui lòng nhập ngày ban hành." });
  }
  if (v.validity === "REPLACED" && !v.replacedById) {
    ctx.addIssue({
      code: "custom",
      path: ["replacedById"],
      message: "Vui lòng chọn văn bản thay thế.",
    });
  }
  if (v.issuedDate && v.effectiveDate && v.effectiveDate < v.issuedDate) {
    ctx.addIssue({
      code: "custom",
      path: ["effectiveDate"],
      message: "Ngày hiệu lực không được trước ngày ban hành.",
    });
  }
  if (v.leadDepartmentId && v.coDepartmentIds.includes(v.leadDepartmentId)) {
    ctx.addIssue({
      code: "custom",
      path: ["coDepartmentIds"],
      message: "Đơn vị chủ trì không đồng thời là đơn vị phối hợp.",
    });
  }
}

export const createDocumentSchema = documentFields
  .extend({ parentId: optionalId })
  .superRefine(crossCheck);

export const updateDocumentSchema = documentFields
  .extend({ id: z.string().min(1) })
  .superRefine(crossCheck);

/** Form dùng chung cho thêm/sửa (id/parentId tuỳ trường hợp) */
export const documentFormSchema = documentFields
  .extend({ id: idField, parentId: optionalId })
  .superRefine(crossCheck);

export const moveDocumentSchema = z.object({
  id: z.string().min(1),
  newParentId: optionalId,
  index: z.number().int().min(0).max(100_000),
});

export const deleteDocumentSchema = z.object({ id: z.string().min(1), cascade: z.boolean() });

export const URGENCY_LABELS: Record<z.infer<typeof urgencyEnum>, string> = {
  NORMAL: "Thường",
  URGENT: "Khẩn",
  VERY_URGENT: "Thượng khẩn",
  FLASH: "Hỏa tốc",
};

export const VALIDITY_LABELS: Record<z.infer<typeof validityEnum>, string> = {
  ACTIVE: "Còn hiệu lực",
  EXPIRED: "Hết hiệu lực",
  REPLACED: "Bị thay thế",
};
