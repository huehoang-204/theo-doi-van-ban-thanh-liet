// Đọc bảng tính đã chuyển thành mảng giá trị → bản ghi hợp lệ + lỗi theo từng dòng (hàm thuần, có unit test).
import { MAX_IMPORT_ROWS, type ImportSpec } from "@/lib/excel/import-specs";
import { normalizeForSearch } from "@/lib/text";

export type ImportRowError = {
  /** Số dòng trong Excel (1 = dòng tiêu đề) */
  row: number;
  column?: string;
  message: string;
};

export type ParsedRow = { row: number; data: Record<string, unknown> };

export type ParseResult = { rows: ParsedRow[]; errors: ImportRowError[] };

export type CellValue = string | number | boolean | Date | null;

/** Giá trị ô của exceljs (rich text, công thức, liên kết…) → giá trị đơn giản */
export function cellToPrimitive(value: unknown): CellValue {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    return value;
  if (value instanceof Date) return value;
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    if (Array.isArray(v.richText))
      return (v.richText as { text: string }[]).map((t) => t.text).join("");
    if ("result" in v) return cellToPrimitive(v.result);
    if ("text" in v) return cellToPrimitive(v.text);
    if ("error" in v) return null;
  }
  return String(value);
}

function isBlank(v: CellValue): boolean {
  return v === null || (typeof v === "string" && v.trim() === "");
}

/** Định dạng lỗi để hiện cho người dùng: "Dòng 5 – Số hộ: Số hộ không được âm." */
export function formatImportError(e: ImportRowError): string {
  return e.column ? `Dòng ${e.row} – ${e.column}: ${e.message}` : `Dòng ${e.row}: ${e.message}`;
}

/**
 * rows[0] là dòng tiêu đề. Cột nhận diện theo tên tiêu đề (không phân biệt dấu/hoa thường) nên
 * người dùng có thể đổi thứ tự cột. Dòng trống bị bỏ qua. Trùng "khoá" (cột đầu) trong file → lỗi.
 */
export function parseSheet(spec: ImportSpec, rows: CellValue[][]): ParseResult {
  const errors: ImportRowError[] = [];
  const header = (rows[0] ?? []).map((h) => normalizeForSearch(String(h ?? "")));
  const colIndex = new Map<string, number>();
  for (const col of spec.columns) {
    const idx = header.indexOf(normalizeForSearch(col.header));
    if (idx >= 0) colIndex.set(col.key, idx);
    else if (col.required) {
      errors.push({
        row: 1,
        message: `Thiếu cột bắt buộc “${col.header}”. Hãy dùng file mẫu tải về từ hệ thống.`,
      });
    }
  }
  if (errors.length > 0) return { rows: [], errors };

  const body = rows.slice(1);
  const dataRowCount = body.filter((r) => !r.every(isBlank)).length;
  if (dataRowCount === 0)
    return { rows: [], errors: [{ row: 2, message: "File không có dòng dữ liệu nào." }] };
  if (dataRowCount > MAX_IMPORT_ROWS) {
    return {
      rows: [],
      errors: [
        {
          row: 1,
          message: `File có ${dataRowCount} dòng, vượt quá giới hạn ${MAX_IMPORT_ROWS} dòng mỗi lần nhập.`,
        },
      ],
    };
  }

  const keyColumn = spec.columns[0]!;
  const seenKeys = new Map<string, number>();
  const parsed: ParsedRow[] = [];

  body.forEach((cells, i) => {
    const rowNumber = i + 2;
    if (cells.every(isBlank)) return;

    const raw: Record<string, unknown> = {};
    let rowHasError = false;
    for (const col of spec.columns) {
      const idx = colIndex.get(col.key);
      let value: CellValue = idx === undefined ? null : (cells[idx] ?? null);
      if (value instanceof Date)
        value = `${value.getUTCDate()}/${value.getUTCMonth() + 1}/${value.getUTCFullYear()}`;
      if (typeof value === "string") value = value.trim();
      if (col.text && typeof value === "number") value = String(value);
      if (col.choices && !isBlank(value)) {
        const match = Object.entries(col.choices).find(
          ([label, enumValue]) =>
            normalizeForSearch(label) === normalizeForSearch(String(value)) ||
            normalizeForSearch(enumValue) === normalizeForSearch(String(value)),
        );
        if (!match) {
          errors.push({
            row: rowNumber,
            column: col.header,
            message: `Giá trị “${String(value)}” không hợp lệ. Chọn một trong: ${Object.keys(col.choices).join(", ")}.`,
          });
          rowHasError = true;
          continue;
        }
        value = match[1];
      }
      raw[col.key] = isBlank(value) ? "" : value;
    }
    if (rowHasError) return;

    const result = spec.rowSchema.safeParse(raw);
    if (!result.success) {
      for (const issue of result.error.issues) {
        const col = spec.columns.find((c) => c.key === issue.path[0]);
        errors.push({ row: rowNumber, column: col?.header, message: issue.message });
      }
      return;
    }

    const key = normalizeForSearch(String(result.data[keyColumn.key] ?? ""));
    const firstRow = seenKeys.get(key);
    if (firstRow !== undefined) {
      errors.push({
        row: rowNumber,
        column: keyColumn.header,
        message: `Trùng với dòng ${firstRow} (“${String(result.data[keyColumn.key])}”).`,
      });
      return;
    }
    seenKeys.set(key, rowNumber);
    parsed.push({ row: rowNumber, data: result.data });
  });

  return { rows: parsed, errors };
}
