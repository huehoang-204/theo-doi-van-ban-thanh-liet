// Bộ dựng schema zod dùng chung cho form (client) và server action — câu lỗi tiếng Việt đầy đủ (Mục 8.2.8).
// Form gửi chuỗi rỗng "" cho ô trống → các helper đổi về null.
import { z } from "zod";

const emptyToNull = (v: unknown) => (v === "" || v === undefined ? null : v);
/**
 * Chuỗi số kiểu Việt → number: "92.000" → 92000, "6,44" → 6.44, "1.234,5" → 1234.5.
 * Không có dấu phẩy và không đúng dạng nhóm nghìn thì dấu chấm là thập phân ("21.03" → 21.03).
 */
export function toNumber(v: unknown): number | null {
  if (v === "" || v === undefined || v === null) return null;
  if (typeof v === "number") return v;
  let s = String(v).trim().replace(/\s/g, "");
  if (s === "") return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  return Number(s);
}

export function requiredText(label: string, max = 200) {
  return z
    .string({ error: `Vui lòng nhập ${label}.` })
    .trim()
    .min(1, `Vui lòng nhập ${label}.`)
    .max(max, `${capitalize(label)} tối đa ${max} ký tự.`);
}

export function optionalText(label: string, max = 500) {
  return z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z.preprocess(
      emptyToNull,
      z
        .string()
        .max(max, `${capitalize(label)} tối đa ${max} ký tự.`)
        .nullable(),
    ),
  );
}

type IntOptions = { min?: number; max?: number };

function intSchema(label: string, { min = 0, max = 10_000_000 }: IntOptions) {
  return z
    .number({ error: `${capitalize(label)} phải là số.` })
    .refine((n) => !Number.isNaN(n), `${capitalize(label)} phải là số.`)
    .refine((n) => Number.isInteger(n), `${capitalize(label)} phải là số nguyên.`)
    .refine(
      (n) => n >= min,
      min === 0
        ? `${capitalize(label)} không được âm.`
        : `${capitalize(label)} phải từ ${min} trở lên.`,
    )
    .refine(
      (n) => n <= max,
      `${capitalize(label)} không được vượt quá ${max.toLocaleString("vi-VN")}.`,
    );
}

export function optionalInt(label: string, options: IntOptions = {}) {
  return z.preprocess(toNumber, intSchema(label, options).nullable());
}

export function requiredInt(label: string, options: IntOptions = {}) {
  return z.preprocess(
    toNumber,
    z
      .union([intSchema(label, options), z.null()])
      .refine((v) => v !== null, `Vui lòng nhập ${label}.`),
  ) as unknown as z.ZodType<number, unknown>;
}

export function optionalDecimal(label: string, { min = -1e9, max = 1e9 } = {}) {
  return z.preprocess(
    toNumber,
    z
      .number({ error: `${capitalize(label)} phải là số.` })
      .refine((n) => !Number.isNaN(n), `${capitalize(label)} phải là số.`)
      .refine(
        (n) => n >= min && n <= max,
        `${capitalize(label)} phải trong khoảng ${min} – ${max}.`,
      )
      .nullable(),
  );
}

/** Id tham chiếu (select) — "" → null */
export const optionalId = z.preprocess(emptyToNull, z.string().min(1).nullable());

export const idField = z.preprocess(emptyToNull, z.string().min(1).nullable().optional());

export const boolField = z.preprocess((v) => v === true || v === "true" || v === "on", z.boolean());

export function optionalEmail(label = "email") {
  return z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z.preprocess(emptyToNull, z.email(`${capitalize(label)} không đúng định dạng.`).nullable()),
  );
}

export function optionalPhone(label = "số điện thoại") {
  return z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z.preprocess(
      emptyToNull,
      z
        .string()
        .regex(/^[0-9 +().-]{8,20}$/, `${capitalize(label)} chỉ gồm chữ số (8–20 ký tự).`)
        .nullable(),
    ),
  );
}

/** Ngày nhập dạng dd/mm/yyyy → Date 00:00 UTC (cột @db.Date) */
export function optionalDate(label: string) {
  return z.preprocess(
    (v) => {
      if (v instanceof Date) return v;
      if (typeof v !== "string" || v.trim() === "") return null;
      return parseViDate(v.trim()) ?? "INVALID";
    },
    z.union([z.date(), z.null(), z.literal("INVALID")]).refine((v) => v !== "INVALID", {
      message: `${capitalize(label)} phải có dạng dd/mm/yyyy và là ngày có thật.`,
    }) as unknown as z.ZodType<Date | null, unknown>,
  );
}

export function parseViDate(value: string): Date | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  if (!m) return null;
  const [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    return null;
  return date;
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
