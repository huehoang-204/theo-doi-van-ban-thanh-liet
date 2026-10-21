import { expect, test, type Page } from "@playwright/test";

import { login } from "./helpers";

// Giai đoạn 3 — chạy tuần tự (luồng nhiều người dùng trên cùng dữ liệu)
test.describe.configure({ mode: "serial" });

const RUN = Date.now().toString(36).slice(-5);
const row = (page: Page, text: string | RegExp) =>
  page.locator("[data-node-row]").filter({ has: page.getByRole("link", { name: text }) });

async function openDocument(page: Page, name: RegExp) {
  await page.goto("/van-ban");
  await page.getByRole("button", { name: "Mở tất cả" }).click();
  await row(page, name).getByRole("link").click();
  // Lần đầu dev server biên dịch trang chi tiết có thể lâu
  await expect(page.getByRole("heading", { level: 2 })).toBeVisible({ timeout: 60_000 });
}

test.describe("Báo cáo — tiêu chí nghiệm thu Giai đoạn 3", () => {
  test("hằng tháng ngày 20, 01/2026–12/2026, 3 đơn vị → 36 kỳ; nộp ngày 21 → “Đã nộp trễ”", async ({
    page,
  }) => {
    await login(page, "vanthu");
    await openDocument(page, /20\/KH-UBND/);
    await page.getByRole("tab", { name: /^Báo cáo/ }).click();
    await page.getByRole("button", { name: "Yêu cầu báo cáo" }).click();

    const dialog = page.getByRole("dialog");
    const name = `Báo cáo đô thị văn minh ${RUN}`;
    await dialog.getByRole("textbox", { name: /^Tên báo cáo/ }).fill(name);
    await dialog
      .getByRole("combobox", { name: /^Kiểu báo cáo/ })
      .selectOption({ label: "Hằng tháng" });
    await dialog.getByRole("textbox", { name: /^Ngày hạn trong kỳ/ }).fill("20");
    await dialog.getByRole("textbox", { name: /^Áp dụng từ ngày/ }).fill("01/01/2026");
    await dialog.getByRole("textbox", { name: /^Đến ngày/ }).fill("31/12/2026");
    for (const dept of [
      "Văn phòng HĐND và UBND",
      "Phòng Kinh tế, Hạ tầng và Đô thị",
      "Phòng Văn hóa – Xã hội",
    ]) {
      await dialog.getByRole("checkbox", { name: dept }).check();
    }
    // Xem trước ngay trên form
    await expect(dialog.getByRole("status")).toContainText("sẽ sinh 36 kỳ (12 kỳ × 3 đơn vị)");
    await dialog.getByRole("button", { name: "Tạo yêu cầu & sinh kỳ" }).click();
    await expect(page.getByText("Đã sinh 36 kỳ báo cáo.")).toBeVisible();
    await expect(page.getByTestId("requirement-stats").filter({ hasText: "36 kỳ" })).toBeVisible();

    // Trang Theo dõi báo cáo lọc theo yêu cầu: đúng 36 kỳ
    await page.getByRole("link", { name: "Mọi kỳ" }).last().click();
    await expect(page.getByRole("tab", { name: /^Tất cả kỳ/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByText("36 dòng")).toBeVisible();

    // Nộp kỳ tháng 01/2026 của Phòng Văn hóa – Xã hội vào ngày 21/01/2026
    await page
      .getByRole("combobox", { name: "Lọc theo đơn vị" })
      .selectOption({ label: "Phòng Văn hóa – Xã hội" });
    const jan = page.getByRole("row").filter({ hasText: "Tháng 01/2026" });
    await jan.getByRole("button", { name: "Nộp báo cáo" }).click();
    const submit = page.getByRole("dialog");
    await submit.getByRole("textbox", { name: /^Số, ký hiệu/ }).fill(`7/BC-VHXH-${RUN}`);
    await submit.getByRole("textbox", { name: /^Ngày gửi/ }).fill("21/01/2026");
    await submit.getByRole("button", { name: "Nộp báo cáo" }).click();
    await expect(page.getByText("Đã nộp báo cáo.")).toBeVisible();
    await expect(jan.getByText("Đã nộp trễ")).toBeVisible();
    await expect(jan.locator('[data-status="HOAN_THANH_TRE"]')).toBeVisible();

    // Báo cáo đã nộp tự thành văn bản con của 20/KH-UBND
    await jan.getByRole("link", { name: "Xem trên cây văn bản" }).click();
    await expect(page.getByRole("heading", { level: 2 })).toContainText(`${name} — Tháng 01/2026`);
    await expect(page.getByRole("navigation", { name: "Vị trí trong cây" })).toContainText(
      "20/KH-UBND",
    );
  });
});

test.describe("Công việc — luồng giao, cập nhật, báo hoàn thành, duyệt", () => {
  const title = `Rà soát hồ sơ đô thị ${RUN}`;

  test("văn thư giao việc từ văn bản cho cán bộ", async ({ page }) => {
    await login(page, "vanthu");
    await openDocument(page, /20\/KH-UBND/);
    await page.getByRole("button", { name: "Giao việc" }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Từ văn bản: 20/KH-UBND");
    await dialog.getByRole("textbox", { name: /^Tiêu đề công việc/ }).fill(title);
    await dialog
      .getByRole("combobox", { name: /^Cá nhân chủ trì/ })
      .selectOption({ label: "Cán bộ Kinh tế (mẫu) — Phòng Kinh tế, Hạ tầng và Đô thị" });
    await dialog.getByRole("textbox", { name: /^Hạn hoàn thành/ }).fill("31/12/2026");
    await dialog.getByRole("button", { name: "Giao việc" }).click();
    await expect(page.getByText("Đã giao việc.")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.getByText("Mới giao")).toBeVisible();
  });

  test("cán bộ: Việc của tôi là trang mặc định; cập nhật tiến độ kèm minh chứng; đề nghị gia hạn; báo hoàn thành", async ({
    page,
  }) => {
    await login(page, "canbo1");
    await expect(page).toHaveURL(/\/viec-cua-toi$/);
    for (const card of ["QUA_HAN", "SAP_DEN_HAN", "DANG_LAM"])
      await expect(page.getByTestId(`card-${card}`)).toBeVisible();

    const item = page.getByRole("listitem").filter({ hasText: title });
    await expect(item).toBeVisible();
    await item.getByRole("button", { name: "Cập nhật tiến độ" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("slider").fill("50");
    await expect(dialog.getByText("50%").first()).toBeVisible();
    await dialog
      .getByRole("textbox", { name: /^Nội dung đã làm/ })
      .fill("Đã rà soát một nửa hồ sơ");
    await dialog.getByLabel("Chọn tệp…").setInputFiles({
      name: "minh-chung.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\n%%EOF\n"),
    });
    await dialog.getByRole("button", { name: "Lưu tiến độ" }).click();
    await expect(page.getByText("Đã cập nhật tiến độ.")).toBeVisible();
    await expect(item.getByRole("progressbar", { name: "Tiến độ 50%" })).toBeVisible();

    await item.getByRole("link", { name: title }).click();
    await expect(page.getByRole("link", { name: /minh-chung\.pdf/ })).toBeVisible();

    // Đề nghị gia hạn: hạn mới phải sau hạn cũ
    await page.getByRole("button", { name: "Đề nghị gia hạn" }).click();
    const ext = page.getByRole("dialog");
    await ext.getByRole("textbox", { name: /^Hạn mới/ }).fill("15/01/2027");
    await ext.getByRole("textbox", { name: /^Lý do/ }).fill("Chờ số liệu từ tổ dân phố");
    await ext.getByRole("button", { name: "Gửi đề nghị" }).click();
    await expect(page.getByText("Đã gửi đề nghị gia hạn.")).toBeVisible();

    await page.getByRole("button", { name: "Báo hoàn thành" }).click();
    const submit = page.getByRole("dialog");
    await submit
      .getByRole("textbox", { name: /^Kết quả thực hiện/ })
      .fill("Đã rà soát xong toàn bộ");
    await submit.getByRole("button", { name: "Báo hoàn thành" }).click();
    await expect(page.getByText("Đã báo hoàn thành, chờ duyệt.")).toBeVisible();
    await expect(page.getByText("Chờ duyệt hoàn thành")).toBeVisible();
  });

  test("người giao: thấy việc chờ duyệt, đồng ý gia hạn, trả lại rồi duyệt khi báo lại", async ({
    page,
    browser,
  }) => {
    await login(page, "vanthu");
    await page.goto("/viec-cua-toi");
    await page.getByRole("link", { name: title }).first().click();

    await page.getByRole("button", { name: "Xét đề nghị gia hạn" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Đồng ý gia hạn" }).click();
    await expect(page.getByText("Đã đồng ý gia hạn.")).toBeVisible();
    await expect(page.getByText("15/01/2027").first()).toBeVisible();

    await page.getByRole("button", { name: "Trả lại" }).click();
    await page
      .getByRole("dialog")
      .getByRole("textbox", { name: /^Lý do trả lại/ })
      .fill("Bổ sung biên bản");
    await page.getByRole("dialog").getByRole("button", { name: "Trả lại" }).click();
    await expect(page.getByText("Đã trả lại công việc.")).toBeVisible();
    await expect(page.getByText("Đang thực hiện").first()).toBeVisible();

    // Cán bộ báo lại
    const officer = await browser.newPage();
    await login(officer, "canbo1");
    await officer.goto("/cong-viec");
    await officer.getByRole("link", { name: title }).click();
    await officer.getByRole("button", { name: "Báo hoàn thành" }).click();
    await officer
      .getByRole("dialog")
      .getByRole("textbox", { name: /^Kết quả thực hiện/ })
      .fill("Đã bổ sung biên bản");
    await officer.getByRole("dialog").getByRole("button", { name: "Báo hoàn thành" }).click();
    await expect(officer.getByText("Đã báo hoàn thành, chờ duyệt.")).toBeVisible();
    await officer.close();

    await page.reload();
    await page.getByRole("button", { name: "Duyệt hoàn thành" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Duyệt hoàn thành" }).click();
    await expect(page.getByText("Đã duyệt hoàn thành.")).toBeVisible();
    await expect(page.getByText("Hoàn thành đúng hạn")).toBeVisible();
    const timeline = page.getByRole("list", { name: "Quá trình xử lý" });
    for (const step of [
      "Giao việc",
      "Cập nhật tiến độ — 50%",
      "Đề nghị gia hạn",
      "Xét gia hạn",
      "Trả lại",
      "Duyệt hoàn thành",
    ]) {
      await expect(timeline.getByText(step).first()).toBeVisible();
    }
  });
});

test.describe("Tiến độ cộng dồn & chấm đỏ trên cây", () => {
  test("nhánh có việc quá hạn có chấm đỏ; chương trình hiển thị % cộng dồn", async ({ page }) => {
    await login(page, "chutich");
    await page.goto("/van-ban");
    const program = row(page, "Chương trình công tác trọng tâm năm 2026");
    await expect(program.getByLabel("Nhánh có việc quá hạn")).toBeVisible();
    await expect(program).toContainText("%");
    await page.getByRole("button", { name: "Mở tất cả" }).click();
    // Nhánh chỉ có Quy chế/Phụ lục (không có việc) thì không hiện %
    await expect(row(page, "Danh sách thành viên Tổ công tác")).not.toContainText("%");
  });

  test("danh sách công việc lọc “Quá hạn” từ tham số URL (để bảng điều hành dẫn sang)", async ({
    page,
  }) => {
    await login(page, "chutich");
    await page.goto("/cong-viec?trangThai=QUA_HAN");
    await expect(page.getByRole("combobox", { name: "Lọc theo trạng thái" })).toHaveValue(
      "QUA_HAN",
    );
    const statuses = await page
      .locator("tbody [data-status]")
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-status")));
    expect(statuses.length).toBeGreaterThan(0);
    expect(new Set(statuses)).toEqual(new Set(["QUA_HAN"]));
  });
});
