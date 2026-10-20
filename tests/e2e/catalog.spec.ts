import { expect, test } from "@playwright/test";
import ExcelJS from "exceljs";

import { login } from "./helpers";

async function residentialWorkbook(rows: (string | number | null)[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("To dan pho");
  ws.addRow([
    "Tên TDP",
    "Số thứ tự",
    "Khu vực cũ",
    "Tổ trưởng",
    "SĐT tổ trưởng",
    "Số hộ",
    "Số nhân khẩu",
    "Chi bộ phụ trách",
    "Ghi chú",
  ]);
  for (const r of rows) ws.addRow(r);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

test.describe("Danh mục địa bàn", () => {
  test("nhập file Excel 60 TDP thành công; file sai báo lỗi đúng dòng và không nhập dòng nào", async ({
    page,
  }) => {
    await login(page, "vanthu");
    await page.goto("/dia-ban/to-dan-pho");

    // File sai: dòng 3 số hộ âm, dòng 5 khu vực cũ không có trong danh mục
    const bad = await residentialWorkbook([
      ["TDP nhập thử lỗi 1", 901, "Thanh Liệt", null, null, 100, 350, null, null],
      ["TDP nhập thử lỗi 2", 902, "Thanh Liệt", null, null, -3, 350, null, null],
      ["TDP nhập thử lỗi 3", 903, "Thanh Liệt", null, null, 100, 350, null, null],
      ["TDP nhập thử lỗi 4", 904, "Khu không có", null, null, 100, 350, null, null],
    ]);
    await page.getByRole("button", { name: "Nhập Excel" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Bước 2. Chọn tệp Excel (.xlsx) đã điền").setInputFiles({
      name: "tdp-loi.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: bad,
    });
    await dialog.getByRole("button", { name: "Nhập dữ liệu" }).click();
    await expect(dialog.getByRole("alert").filter({ hasText: "Dòng" })).toContainText(
      "Tệp có 1 lỗi",
    );
    await expect(dialog.getByRole("alert").filter({ hasText: "Dòng" })).toContainText(
      "Dòng 3 – Số hộ: Số hộ không được âm.",
    );

    const bad2 = await residentialWorkbook([
      ["TDP nhập thử lỗi 4", 904, "Khu không có", null, null, 100, 350, null, null],
    ]);
    await dialog
      .getByLabel("Bước 2. Chọn tệp Excel (.xlsx) đã điền")
      .setInputFiles({ name: "tdp-loi2.xlsx", mimeType: "application/octet-stream", buffer: bad2 });
    await dialog.getByRole("button", { name: "Nhập dữ liệu" }).click();
    await expect(dialog.getByRole("alert").filter({ hasText: "Dòng" })).toContainText(
      "Dòng 2 – Khu vực cũ: Không tìm thấy “Khu không có” trong danh mục Khu vực cũ.",
    );

    // File đúng: 60 TDP
    const good = await residentialWorkbook(
      Array.from({ length: 60 }, (_, i) => [
        `TDP nhập thử ${i + 1}`,
        1000 + i,
        "Tân Triều",
        `Tổ trưởng ${i + 1}`,
        "0912345678",
        300 + i,
        1000 + i,
        null,
        null,
      ]),
    );
    await dialog
      .getByLabel("Bước 2. Chọn tệp Excel (.xlsx) đã điền")
      .setInputFiles({ name: "tdp-60.xlsx", mimeType: "application/octet-stream", buffer: good });
    await dialog.getByRole("button", { name: "Nhập dữ liệu" }).click();
    await expect(page.getByText("Đã nhập 60 dòng: thêm mới 60, cập nhật 0.")).toBeVisible();
    await expect(dialog).toBeHidden();

    await page.getByRole("searchbox", { name: "Tìm tổ dân phố…" }).fill("tdp nhap thu");
    await expect(page.getByText("60 / 100 dòng")).toBeVisible();
    // Không có dòng nào của file lỗi được nhập
    await page.getByRole("searchbox", { name: "Tìm tổ dân phố…" }).fill("nhap thu loi");
    await expect(page.getByRole("cell", { name: "Không tìm thấy kết quả phù hợp." })).toBeVisible();
  });

  test("tải file mẫu nhập liệu và xuất Excel trường học", async ({ page }) => {
    await login(page, "vanthu");
    const template = await page.request.get("/api/import/schools/mau");
    expect(template.status()).toBe(200);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await template.body()) as unknown as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Truong hoc", "Huong dan"]);
    expect(wb.worksheets[0]!.getRow(1).getCell(2).value).toBe("Cấp học");

    const exported = await page.request.get("/api/export/schools?namHoc=2026-2027");
    expect(exported.status()).toBe(200);
    expect(exported.headers()["content-disposition"]).toContain("Truong-hoc_2026-2027");
  });

  test("form báo lỗi tiếng Việt khi rời ô; quản trị thêm đơn vị mới", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/quan-tri/don-vi");
    await page.getByRole("button", { name: "Thêm đơn vị" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Tên đơn vị").focus();
    await dialog.getByLabel("Tên viết tắt").focus();
    await expect(dialog.getByText("Vui lòng nhập tên đơn vị.")).toBeVisible();

    await dialog.getByLabel("Tên đơn vị").fill("Đơn vị thử nghiệm E2E");
    await dialog.getByRole("button", { name: "Lưu" }).click();
    await expect(page.getByText("Đã thêm đơn vị.")).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "Đơn vị thử nghiệm E2E", exact: true }),
    ).toBeVisible();
  });

  test("tổ chức đảng hiển thị dạng cây và số liệu tự đếm", async ({ page }) => {
    await login(page, "xaydungdang");
    await page.goto("/dia-ban/to-chuc-dang");
    await expect(page.getByText("Tổ chức đảng trực thuộc", { exact: true })).toBeVisible();
    // Override 63 đang bật (Mục 15) → hiện số nhập tay kèm số đếm thực
    await expect(page.getByText("Số nhập tay · danh mục hiện đếm được 63")).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "Đảng bộ phường Thanh Liệt", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "Chi bộ Khu đô thị 1 (mẫu)", exact: true }),
    ).toBeVisible();
  });
});
