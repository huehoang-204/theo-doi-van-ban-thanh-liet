import "server-only";

import ExcelJS from "exceljs";

import type { ImportSpec } from "@/lib/excel/import-specs";
import { cellToPrimitive, type CellValue } from "@/lib/excel/parse";
import { vi } from "@/lib/i18n/vi";

export type ExportColumn<T> = {
  header: string;
  value: (row: T) => string | number | Date | null | undefined;
  width?: number;
  /** "int" → định dạng #.##0 */
  format?: "int" | "decimal" | "date";
  /** Thụt lề ô theo cấp (cây văn bản xuất Excel — Mục 4.4) */
  indent?: (row: T) => number;
};

const BRAND = "FF1E3A8A";

function styleHeader(row: ExcelJS.Row, requiredCols: Set<number> = new Set()) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.alignment = { vertical: "middle", wrapText: true };
  row.height = 30;
  row.eachCell((cell, col) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: requiredCols.has(col) ? "FFB91C1C" : BRAND },
    };
    cell.border = { bottom: { style: "thin", color: { argb: "FF94A3B8" } } };
  });
}

/** Xuất bảng ra .xlsx: dòng tiêu đề cố định, lọc tự động, định dạng số kiểu Việt */
export async function buildExportWorkbook<T>(
  sheetName: string,
  columns: ExportColumn<T>[],
  rows: T[],
  footer?: (string | number | null)[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = vi.app.wardName;
  wb.created = new Date();
  const ws = wb.addWorksheet(sheetName.slice(0, 31), { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = columns.map((c) => ({
    header: c.header,
    width: c.width ?? 18,
    style:
      c.format === "int"
        ? { numFmt: "#,##0" }
        : c.format === "decimal"
          ? { numFmt: "#,##0.00" }
          : c.format === "date"
            ? { numFmt: "dd/mm/yyyy" }
            : {},
  }));
  for (const row of rows) {
    const added = ws.addRow(columns.map((c) => c.value(row) ?? null));
    columns.forEach((c, i) => {
      if (c.indent)
        added.getCell(i + 1).alignment = {
          indent: Math.max(0, c.indent(row)),
          wrapText: true,
          vertical: "top",
        };
    });
  }
  if (footer) ws.addRow(footer).font = { bold: true };
  styleHeader(ws.getRow(1));
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** File mẫu nhập liệu: sheet dữ liệu (chỉ tiêu đề + ô chọn) và sheet "Hướng dẫn" */
export async function buildImportTemplate(spec: ImportSpec): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = vi.app.wardName;
  const ws = wb.addWorksheet(spec.sheetName, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = spec.columns.map((c) => ({
    header: c.header,
    width: c.width ?? 18,
    style: c.text ? { numFmt: "@" } : {},
  }));
  const required = new Set(spec.columns.flatMap((c, i) => (c.required ? [i + 1] : [])));
  styleHeader(ws.getRow(1), required);

  // Ô chọn thả xuống cho cột có danh sách giá trị (500 dòng đầu)
  spec.columns.forEach((c, i) => {
    if (!c.choices) return;
    const list = `"${Object.keys(c.choices).join(",")}"`;
    const letter = ws.getColumn(i + 1).letter;
    for (let r = 2; r <= 501; r++) {
      ws.getCell(`${letter}${r}`).dataValidation = {
        type: "list",
        allowBlank: !c.required,
        formulae: [list],
        showErrorMessage: true,
        errorTitle: "Giá trị không hợp lệ",
        error: `Chọn một trong: ${Object.keys(c.choices).join(", ")}`,
      };
    }
  });

  const guide = wb.addWorksheet("Huong dan");
  guide.columns = [
    { header: "Cột", width: 26 },
    { header: "Bắt buộc", width: 10 },
    { header: "Giá trị hợp lệ / ghi chú", width: 70 },
    { header: "Ví dụ", width: 30 },
  ];
  styleHeader(guide.getRow(1));
  for (const c of spec.columns) {
    guide.addRow([
      c.header,
      c.required ? "Có" : "",
      [c.choices ? `Chọn: ${Object.keys(c.choices).join(", ")}` : "", c.note ?? ""]
        .filter(Boolean)
        .join(". "),
      spec.example[c.key] ?? "",
    ]);
  }
  guide.addRow([]);
  guide.addRow([
    "Lưu ý:",
    "",
    "Nhập dữ liệu ở sheet đầu tiên, từ dòng 2. Cột tiêu đề màu đỏ là bắt buộc. Không đổi tên tiêu đề cột.",
  ]);
  guide.addRow([
    "",
    "",
    "Bản ghi trùng tên với dữ liệu đã có sẽ được CẬP NHẬT; tên mới sẽ được THÊM. File có lỗi sẽ không nhập dòng nào.",
  ]);
  guide.addRow(["", "", "Không nhập thông tin có độ mật vào hệ thống."]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Đọc sheet đầu tiên của file .xlsx thành mảng giá trị */
export async function readFirstSheet(buffer: ArrayBuffer): Promise<CellValue[][]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const rows: CellValue[][] = [];
  const width = ws.columnCount;
  ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const values: CellValue[] = [];
    for (let c = 1; c <= width; c++) values.push(cellToPrimitive(row.getCell(c).value));
    rows[rowNumber - 1] = values;
  });
  return Array.from(rows, (r) => r ?? []);
}

/** Phản hồi tải tệp .xlsx (tên tệp tiếng Việt mã hoá theo RFC 5987) */
export function xlsxResponse(buffer: Buffer, fileName: string): Response {
  const ascii = fileName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^\w.-]+/g, "_");
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "no-store",
    },
  });
}
