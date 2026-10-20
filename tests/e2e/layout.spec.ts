import { expect, test } from "@playwright/test";

import { login } from "./helpers";

const SCREENSHOT_DIR = "test-results/screens";

async function rootFontSizePx(page: import("@playwright/test").Page): Promise<number> {
  return page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
}

test.describe("Khung giao diện", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();
    await login(page, "chutich");
  });

  test("trang chủ có header, menu tiếng Việt và breadcrumb", async ({
    page,
    isMobile,
  }, testInfo) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/Bảng điều hành — Phường Thanh Liệt/);
    await expect(page.locator("html")).toHaveAttribute("lang", "vi");
    await expect(page.getByRole("banner")).toContainText("Phường Thanh Liệt");
    await expect(page.getByRole("heading", { level: 1, name: "Bảng điều hành" })).toBeVisible();

    if (isMobile) {
      // < 768px: thanh bên ẩn, mở bằng hamburger
      await expect(page.getByRole("complementary", { name: "Menu chính" })).toBeHidden();
      await page.getByRole("button", { name: "Mở menu" }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("link", { name: "Văn bản" })).toBeVisible();
      await page.screenshot({ path: `${SCREENSHOT_DIR}/${testInfo.project.name}-menu.png` });
      await dialog.getByRole("link", { name: "Văn bản" }).click();
      await expect(dialog).toBeHidden();
    } else {
      const sidebar = page.getByRole("complementary", { name: "Menu chính" });
      await expect(sidebar).toBeVisible();
      await expect(sidebar.getByRole("link", { name: "Văn bản" })).toBeVisible();
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/${testInfo.project.name}-home.png`,
        fullPage: true,
      });
      await sidebar.getByRole("link", { name: "Văn bản" }).click();
    }

    await expect(page).toHaveURL(/\/van-ban$/);
    await expect(page.getByRole("heading", { level: 1, name: "Văn bản" })).toBeVisible();
  });

  test("breadcrumb của trang thuộc nhóm Địa bàn", async ({ page }) => {
    await page.goto("/dia-ban/truong-hoc");
    const crumbs = page.getByRole("navigation", { name: "Đường dẫn" });
    await expect(crumbs).toContainText("Địa bàn");
    await expect(crumbs).toContainText("Trường học");
  });

  test("nút A+ tăng cỡ chữ và được nhớ sau khi tải lại", async ({ page }, testInfo) => {
    await page.goto("/");
    // Cỡ chữ lưu theo tài khoản (test khác có thể đã đổi) → đưa về mức nhỏ nhất trước
    const decrease = page.getByRole("button", { name: "Giảm cỡ chữ" });
    while (await decrease.isEnabled()) await decrease.click();
    await expect.poll(() => rootFontSizePx(page)).toBeCloseTo(16, 0);

    const increase = page.getByRole("button", { name: "Tăng cỡ chữ" });
    await increase.click();
    await increase.click();
    await expect.poll(() => rootFontSizePx(page)).toBeCloseTo(20, 0); // 16 × 1,25
    await expect(increase).toBeDisabled();

    await page.reload();
    expect(await rootFontSizePx(page)).toBeCloseTo(20, 0);

    // Bố cục không bị tràn ngang ở cỡ chữ lớn nhất
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/${testInfo.project.name}-a-plus.png`,
      fullPage: true,
    });
  });

  test("trang không tồn tại báo lỗi tiếng Việt", async ({ page }) => {
    const response = await page.goto("/khong-ton-tai");
    expect(response?.status()).toBe(404);
    await expect(page.getByText("Không tìm thấy trang")).toBeVisible();
  });
});
