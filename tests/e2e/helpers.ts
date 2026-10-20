import { expect, type Page } from "@playwright/test";

import { TEST_PASSWORD } from "./env";

export async function login(page: Page, username: string, password = TEST_PASSWORD) {
  await page.goto("/dang-nhap");
  await page.getByLabel("Tên đăng nhập").fill(username);
  await page.getByRole("textbox", { name: "Mật khẩu", exact: true }).fill(password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page).not.toHaveURL(/\/dang-nhap/);
}

/** Tên các mục menu đang hiển thị ở thanh bên (gồm cả mục con của nhóm đang mở rộng) */
export async function sidebarLinks(page: Page): Promise<string[]> {
  const sidebar = page.getByRole("complementary", { name: "Menu chính" });
  // Mở mọi nhóm để thấy mục con
  const collapsed = sidebar.locator("button[aria-expanded=false]:visible");
  while ((await collapsed.count()) > 0) await collapsed.first().click();
  return (await sidebar.getByRole("link").allInnerTexts()).map((t) => t.trim()).filter(Boolean);
}
