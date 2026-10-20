import { describe, expect, it } from "vitest";

import { IMPORT_SPECS } from "@/lib/excel/import-specs";
import { cellToPrimitive, formatImportError, parseSheet, type CellValue } from "@/lib/excel/parse";

const tdp = IMPORT_SPECS.residentials;
const header: CellValue[] = tdp.columns.map((c) => c.header);

/** Tạo bảng 60 TDP hợp lệ như tiêu chí nghiệm thu Giai đoạn 1 */
function sixtyResidentials(): CellValue[][] {
  return Array.from({ length: 60 }, (_, i) => [
    `Tổ dân phố số ${i + 1}`,
    i + 1,
    "Thanh Liệt",
    `Tổ trưởng ${i + 1}`,
    "0912345678",
    300 + i,
    1000 + i * 3,
    null,
    null,
  ]);
}

describe("nhập Excel tổ dân phố", () => {
  it("60 TDP hợp lệ → 60 bản ghi, không lỗi", () => {
    const result = parseSheet(tdp, [header, ...sixtyResidentials()]);
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(60);
    expect(result.rows[0]).toEqual({
      row: 2,
      data: expect.objectContaining({
        name: "Tổ dân phố số 1",
        code: 1,
        households: 300,
        population: 1000,
        oldAreaName: "Thanh Liệt",
      }),
    });
    expect(result.rows[59]?.row).toBe(61);
  });

  it("báo lỗi đúng dòng, đúng cột, câu tiếng Việt", () => {
    const rows = sixtyResidentials();
    rows[2]![5] = -5; // dòng Excel 4: số hộ âm
    rows[9]![6] = "nhiều"; // dòng Excel 11: nhân khẩu là chữ
    rows[14]![0] = ""; // dòng Excel 16: thiếu tên
    rows[20]![0] = "Tổ dân phố số 1"; // dòng Excel 22: trùng tên dòng 2
    const result = parseSheet(tdp, [header, ...rows]);
    expect(result.errors.map(formatImportError)).toEqual([
      "Dòng 4 – Số hộ: Số hộ không được âm.",
      "Dòng 11 – Số nhân khẩu: Số nhân khẩu phải là số.",
      "Dòng 16 – Tên TDP: Vui lòng nhập tên tổ dân phố.",
      "Dòng 22 – Tên TDP: Trùng với dòng 2 (“Tổ dân phố số 1”).",
    ]);
    expect(result.rows).toHaveLength(56);
  });

  it("đổi thứ tự cột, tiêu đề không dấu vẫn nhận; bỏ dòng trống; SĐT dạng số giữ thành chuỗi", () => {
    const result = parseSheet(tdp, [
      ["so ho", "TEN TDP", "SĐT tổ trưởng"],
      [120, "TDP Văn Điển", 912345678],
      [null, "", null],
      ["", "TDP Hạ Đình", null],
    ]);
    expect(result.errors).toEqual([]);
    expect(
      result.rows.map((r) => [r.row, r.data.name, r.data.households, r.data.leaderPhone]),
    ).toEqual([
      [2, "TDP Văn Điển", 120, "912345678"],
      [4, "TDP Hạ Đình", null, null],
    ]);
  });

  it("thiếu cột bắt buộc → lỗi ở dòng tiêu đề", () => {
    const result = parseSheet(tdp, [["Số hộ"], [12]]);
    expect(result.errors.map(formatImportError)).toEqual([
      "Dòng 1: Thiếu cột bắt buộc “Tên TDP”. Hãy dùng file mẫu tải về từ hệ thống.",
    ]);
  });

  it("file không có dữ liệu", () => {
    expect(parseSheet(tdp, [header]).errors[0]?.message).toBe("File không có dòng dữ liệu nào.");
  });
});

describe("nhập Excel trường học & tổ chức đảng", () => {
  it("cột chọn nhận nhãn tiếng Việt (không phân biệt dấu) và báo lỗi khi sai", () => {
    const spec = IMPORT_SPECS.schools;
    const head = spec.columns.map((c) => c.header);
    const row = (level: string): CellValue[] => [
      "Trường A",
      level,
      "Công lập",
      ...Array(10).fill(null),
    ];
    const ok = parseSheet(spec, [head, row("mam non")]);
    expect(ok.rows[0]?.data.level).toBe("MAM_NON");
    const bad = parseSheet(spec, [head, row("Mẫu giáo")]);
    expect(formatImportError(bad.errors[0]!)).toBe(
      "Dòng 2 – Cấp học: Giá trị “Mẫu giáo” không hợp lệ. Chọn một trong: Mầm non, Tiểu học, THCS, THPT, Liên cấp, GDNN-GDTX.",
    );
  });

  it("trường học: có số liệu thì bắt buộc năm học, CB-GV-NV, học sinh", () => {
    const spec = IMPORT_SPECS.schools;
    const head = spec.columns.map((c) => c.header);
    const r = parseSheet(spec, [
      head,
      ["Trường B", "THCS", "Công lập", null, null, null, null, null, null, null, 20, null, null],
    ]);
    expect(r.errors.map((e) => e.column)).toEqual(["Năm học", "Tổng CB-GV-NV", "Số học sinh"]);
  });

  it("tổ chức đảng: tổng đảng viên phải bằng chính thức + dự bị", () => {
    const spec = IMPORT_SPECS["party-orgs"];
    const head = spec.columns.map((c) => c.header);
    const r = parseSheet(spec, [
      head,
      ["Chi bộ X", "Chi bộ cơ sở", "Trường học", null, null, null, null, 30, 20, 5],
    ]);
    expect(formatImportError(r.errors[0]!)).toBe(
      "Dòng 2 – Số đảng viên: Tổng số đảng viên phải bằng chính thức + dự bị.",
    );
  });
});

describe("giá trị ô exceljs", () => {
  it("rich text, công thức, liên kết → giá trị đơn giản", () => {
    expect(cellToPrimitive({ richText: [{ text: "Tổ " }, { text: "1" }] })).toBe("Tổ 1");
    expect(cellToPrimitive({ formula: "A1+1", result: 42 })).toBe(42);
    expect(cellToPrimitive({ text: "x@y.vn", hyperlink: "mailto:x@y.vn" })).toBe("x@y.vn");
    expect(cellToPrimitive(undefined)).toBeNull();
  });
});
