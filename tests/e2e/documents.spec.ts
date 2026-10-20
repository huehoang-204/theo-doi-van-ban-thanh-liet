import { expect, test, type Page } from "@playwright/test";
import ExcelJS from "exceljs";

import { login } from "./helpers";

// Cây văn bản (Giai đoạn 2) — chạy tuần tự vì các bước dùng chung dữ liệu.
test.describe.configure({ mode: "serial" });

const RUN = Date.now().toString(36).slice(-5);

const row = (page: Page, text: string | RegExp) =>
  page.locator("[data-node-row]").filter({ has: page.getByRole("link", { name: text }) });

async function fillDocumentForm(
  page: Page,
  opts: { type?: string; title: string; number?: string },
) {
  const dialog = page.getByRole("dialog");
  // Tra theo vai trò: nút ⓘ "Hướng dẫn: …" cũng mang tên nhãn
  if (opts.type)
    await dialog
      .getByRole("combobox", { name: /^Loại văn bản/ })
      .selectOption({ label: opts.type });
  if (opts.number) await dialog.getByRole("textbox", { name: /^Số, ký hiệu/ }).fill(opts.number);
  await dialog.getByRole("textbox", { name: /^Trích yếu/ }).fill(opts.title);
  await dialog
    .getByRole("combobox", { name: /^Cơ quan ban hành/ })
    .selectOption({ label: "UBND phường Thanh Liệt" });
  await dialog.getByRole("button", { name: "Thêm văn bản" }).click();
  await expect(page.getByText("Đã thêm văn bản.").first()).toBeVisible();
  await expect(dialog).toBeHidden();
}

/** Kéo tay nắm ⋮⋮ của dòng `from` thả vào giữa / mép trên dòng `to` (cảm biến con trỏ của dnd-kit) */
async function dragRow(
  page: Page,
  from: string | RegExp,
  to: string | RegExp,
  where: "inside" | "before" = "inside",
) {
  const source = row(page, from);
  await source.hover();
  const handle = source.getByRole("button", { name: /^Kéo để di chuyển/ });
  const hb = (await handle.boundingBox())!;
  const tb = (await row(page, to).boundingBox())!;
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2 + 15, { steps: 5 });
  const y = where === "inside" ? tb.y + tb.height / 2 : tb.y + 3;
  await page.mouse.move(tb.x + tb.width / 2, y, { steps: 15 });
  await page.mouse.up();
}

test.describe("Cây văn bản — tiêu chí nghiệm thu Giai đoạn 2", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "vanthu");
    await page.goto("/van-ban");
  });

  test("tạo được cây đủ 5 cấp; nút thêm con ẩn ở cấp 5", async ({ page }) => {
    await page.getByRole("button", { name: "Chương trình", exact: true }).click();
    await fillDocumentForm(page, { title: `Chương trình thử 5 cấp ${RUN}` });
    await expect(
      page.getByRole("heading", { level: 2, name: `Chương trình thử 5 cấp ${RUN}` }),
    ).toBeVisible();

    const levels = [
      { type: "Kế hoạch (KH)", title: `Kế hoạch cấp 2 ${RUN}` },
      { type: "Quyết định (QD)", title: `Quyết định cấp 3 ${RUN}` },
      { type: "Quy chế (QC)", title: `Quy chế cấp 4 ${RUN}` },
      { type: "Báo cáo (BC)", title: `Báo cáo cấp 5 ${RUN}` },
    ];
    for (const [i, level] of levels.entries()) {
      await page.getByRole("button", { name: "Văn bản con", exact: true }).click();
      await expect(page.getByRole("dialog")).toContainText(`(cấp ${i + 2})`);
      await fillDocumentForm(page, level);
      await expect(page.getByRole("heading", { level: 2, name: level.title })).toBeVisible();
      await expect(page.getByText(`cấp ${i + 2}`, { exact: false }).first()).toBeVisible();
    }

    // Ở cấp 5: không còn nút "Văn bản con" trên trang chi tiết …
    await expect(page.getByRole("button", { name: "Văn bản con", exact: true })).toHaveCount(0);
    // … và trên cây: dòng cấp 5 không có nút "+", dòng cấp 4 thì có
    const leaf = row(page, new RegExp(`Báo cáo cấp 5 ${RUN}`));
    await leaf.hover();
    await expect(leaf.getByTestId("add-child")).toHaveCount(0);
    await expect(leaf).toHaveAttribute("data-depth", "5");
    const level4 = row(page, new RegExp(`Quy chế cấp 4 ${RUN}`));
    await level4.hover();
    await expect(level4.getByTestId("add-child")).toBeVisible();

    // Breadcrumb bấm được từng cấp
    const crumbs = page.getByRole("navigation", { name: "Vị trí trong cây" });
    await expect(crumbs.getByRole("link")).toHaveCount(4);
    await crumbs.getByRole("link", { name: `Kế hoạch cấp 2 ${RUN}` }).click();
    await expect(
      page.getByRole("heading", { level: 2, name: `Kế hoạch cấp 2 ${RUN}` }),
    ).toBeVisible();
  });

  test("kéo nhánh 3 cấp vào nút cấp 3 bị từ chối với thông báo rõ; kéo hợp lệ thì chuyển được", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Mở tất cả" }).click();
    await expect(row(page, /45\/QĐ-UBND/)).toBeVisible();
    // 45/QĐ-UBND (cấp 3) có nhánh 3 cấp (QĐ › Quy chế › Báo cáo); 88/UBND-VP ở cấp 3
    await dragRow(page, /45\/QĐ-UBND/, /88\/UBND-VP/);
    await expect(
      page.getByText(
        "Không thể chuyển: nhánh “45/QĐ-UBND” có 3 cấp, đặt vào “88/UBND-VP” (cấp 3) thì nhánh sẽ xuống tới cấp 6, vượt quá tối đa 5 cấp.",
      ),
    ).toBeVisible();
    await expect(row(page, /45\/QĐ-UBND/)).toHaveAttribute("data-depth", "3");

    // Hợp lệ: kéo "Danh sách thành viên" (cấp 4, lá) vào 88/UBND-VP (cấp 3) → thành cấp 4 dưới 88
    await dragRow(page, "Danh sách thành viên Tổ công tác", /88\/UBND-VP/);
    await expect(page.getByText("Đã chuyển “Danh sách thành viên Tổ công tác”.")).toBeVisible();
    await row(page, "Danh sách thành viên Tổ công tác").getByRole("link").click();
    await expect(page.getByRole("navigation", { name: "Vị trí trong cây" })).toContainText(
      "88/UBND-VP",
    );

    // Chặn kéo vào chính con cháu
    await dragRow(page, /12\/KH-UBND/, "Quy chế hoạt động của Tổ công tác");
    await expect(page.getByText(/vì đó là văn bản con\/cháu của chính nó/)).toBeVisible();
  });

  test("tìm “quyet dinh thanh lap” ra “Quyết định … Thành lập …” và tự mở nhánh", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Thu tất cả" }).click();
    await expect(row(page, /45\/QĐ-UBND/)).toHaveCount(0);
    await page.getByRole("searchbox", { name: "Tìm văn bản" }).fill("quyet dinh thanh lap");
    await expect(page.getByText("Tìm thấy 1 văn bản (tô vàng).")).toBeVisible();
    const hit = row(page, /45\/QĐ-UBND Thành lập Tổ công tác chuyển đổi số/);
    await expect(hit).toBeVisible();
    await expect(hit).toHaveClass(/bg-amber-100/);
    // Gõ có dấu / chữ hoa cũng ra
    await page.getByRole("searchbox", { name: "Tìm văn bản" }).fill("QUYẾT ĐỊNH thành LẬP");
    await expect(page.getByText("Tìm thấy 1 văn bản (tô vàng).")).toBeVisible();
    await page.getByRole("button", { name: "Xoá tìm" }).click();
    await expect(hit).not.toHaveClass(/bg-amber-100/);
  });
});

test.describe("Cây văn bản — thao tác khác", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "vanthu");
    await page.goto("/van-ban");
  });

  test("tải lười: mở nhánh mới gọi máy chủ lấy con của nhánh đó", async ({ page }) => {
    const program = row(page, "Chương trình công tác trọng tâm năm 2026");
    const [res] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/documents/tree?cha=")),
      program.getByRole("button", { name: /^Mở nhánh/ }).click(),
    ]);
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { nodes: { depth: number }[] };
    expect(body.nodes.length).toBeGreaterThan(0);
    expect(body.nodes.every((n) => n.depth === 2)).toBe(true);
    await expect(row(page, /12\/KH-UBND/)).toBeVisible();
  });

  test("đính kèm: PDF hợp lệ xem trước được; tệp giả đuôi .pdf bị từ chối; có cảnh báo văn bản mật", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Mở tất cả" }).click();
    await row(page, /20\/KH-UBND/)
      .getByRole("link")
      .click();
    await page.getByRole("tab", { name: /^Tệp/ }).click();
    await expect(
      page.getByText("Không tải lên văn bản có độ mật (Mật, Tối mật, Tuyệt mật)."),
    ).toBeVisible();

    const pdf = Buffer.from(
      "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
    );
    await page.getByLabel("Tải tệp lên").setInputFiles([
      { name: "ke-hoach-20.pdf", mimeType: "application/pdf", buffer: pdf },
      {
        name: "gia-mao.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("MZ\x90\x00 day la tep thuc thi"),
      },
    ]);
    await expect(page.getByText("Đã tải lên 1 tệp.")).toBeVisible();
    await expect(page.getByText(/Tệp “gia-mao.pdf” không đúng định dạng cho phép/)).toBeVisible();
    await expect(page.getByRole("tab", { name: "Tệp (1)" })).toBeVisible();

    await page.getByRole("button", { name: "Xem" }).click();
    const frame = page.getByTitle("Xem trước ke-hoach-20.pdf");
    await expect(frame).toBeVisible();
    const src = await frame.getAttribute("src");
    const preview = await page.request.get(src!);
    expect(preview.headers()["content-type"]).toBe("application/pdf");
    expect(preview.headers()["content-disposition"]).toMatch(/^inline/);
  });

  test("xoá mềm cả nhánh (phải xác nhận) rồi hoàn tác", async ({ page }) => {
    await page.getByRole("button", { name: "Mở tất cả" }).click();
    const kh = row(page, /20\/KH-UBND/);
    await kh.click({ button: "right" });
    await page.getByRole("menuitem", { name: "Thêm văn bản con" }).click();
    await fillDocumentForm(page, { type: "Công văn (CV)", title: `Công văn con để xoá ${RUN}` });

    await kh.click({ button: "right" });
    await page.getByRole("menuitem", { name: "Xoá…" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText(
      "Văn bản và 1 văn bản con/cháu sẽ được chuyển vào Thùng rác",
    );
    await expect(dialog.getByRole("button", { name: "Xoá cả nhánh" })).toBeDisabled();
    await dialog.getByLabel("Tôi xác nhận xoá cả nhánh").check();
    await dialog.getByRole("button", { name: "Xoá cả nhánh" }).click();
    await expect(page.getByText("Đã chuyển 2 văn bản vào Thùng rác.")).toBeVisible();
    await expect(row(page, /20\/KH-UBND/)).toHaveCount(0);

    await page.getByRole("button", { name: "Hoàn tác" }).click();
    await expect(page.getByText("Đã khôi phục.")).toBeVisible();
    await expect(row(page, /20\/KH-UBND/)).toBeVisible();
  });

  test("dạng danh sách có cột Cấp; xuất Excel cây thụt lề theo cấp", async ({ page }) => {
    await page.getByRole("link", { name: "Dạng danh sách" }).click();
    await expect(page.getByRole("columnheader", { name: "Cấp" })).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "Báo cáo kết quả hoạt động quý I/2026" }),
    ).toBeVisible();

    const res = await page.request.get("/api/export/documents");
    expect(res.status()).toBe(200);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await res.body()) as unknown as ArrayBuffer);
    const ws = wb.worksheets[0]!;
    expect(ws.getRow(1).getCell(4).value).toBe("Trích yếu (thụt lề theo cấp)");
    const rows = Array.from({ length: ws.rowCount - 1 }, (_, i) => ws.getRow(i + 2));
    const report = rows.find((r) => r.getCell(4).value === "Báo cáo kết quả hoạt động quý I/2026")!;
    expect(report.getCell(1).value).toBe(5);
    expect(report.getCell(4).alignment?.indent).toBe(4);
    // Cha đứng trước con
    const idx = (title: string) =>
      rows.findIndex((r) => String(r.getCell(4).value).startsWith(title));
    expect(idx("Chương trình công tác trọng tâm năm 2026")).toBeLessThan(
      idx("Kế hoạch triển khai chuyển đổi số"),
    );
  });

  test("điện thoại: cây hiện trước, bấm vào nút mở trang chi tiết có nút quay lại", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/van-ban");
    await expect(page.getByRole("tree", { name: "Cây văn bản" })).toBeVisible();
    await row(page, "Chương trình công tác trọng tâm năm 2026").getByRole("link").click();
    await expect(
      page.getByRole("heading", { level: 2, name: "Chương trình công tác trọng tâm năm 2026" }),
    ).toBeVisible();
    await expect(page.getByRole("tree", { name: "Cây văn bản" })).toBeHidden();
    await page.getByRole("link", { name: "Cây văn bản" }).click();
    await expect(page.getByRole("tree", { name: "Cây văn bản" })).toBeVisible();
  });
});

test.describe("Phạm vi xem văn bản", () => {
  test("OFFICER không có nút tạo chương trình; VIEWER không thấy văn bản chưa được chia sẻ", async ({
    page,
  }) => {
    await login(page, "canbo1");
    await page.goto("/van-ban");
    await expect(page.getByRole("button", { name: "Chương trình", exact: true })).toHaveCount(0);
    await expect(row(page, "Chương trình công tác trọng tâm năm 2026")).toBeVisible();

    await page.context().clearCookies();
    await login(page, "totruong1");
    await page.goto("/van-ban");
    await expect(page.getByText("Chưa có chương trình nào.").first()).toBeVisible();
  });
});
