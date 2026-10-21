import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";

import { e2eDatabaseUrl } from "./env";
import { login } from "./helpers";

// Giai đoạn 5 — worker nhắc hạn, chuông thông báo, tìm kiếm Ctrl+K, Nhật ký, Thùng rác
const RUN = randomUUID().slice(0, 6);

async function sql<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const c = new Client({ connectionString: e2eDatabaseUrl() });
  await c.connect();
  try {
    return (await c.query(text, params)).rows as T[];
  } finally {
    await c.end();
  }
}

/** Ngày hôm nay theo giờ VN (+ n ngày) dạng YYYY-MM-DD */
function vnDay(plus = 0): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(
    new Date(),
  );
  return new Date(Date.parse(`${today}T00:00:00Z`) + plus * 86_400_000).toISOString().slice(0, 10);
}

/** Chạy worker một lần trên CSDL E2E (như `npm run worker -- --once …`) */
function runWorker(job: "daily" | "nightly", now: string) {
  return execFileSync("npx", ["tsx", "src/worker/index.ts", "--once", job, "--now", now], {
    env: { ...process.env, DATABASE_URL: e2eDatabaseUrl() },
    encoding: "utf8",
    timeout: 120_000,
  });
}

const userId = async (username: string) =>
  (await sql<{ id: string }>(`SELECT id FROM "User" WHERE username = $1`, [username]))[0]!.id;

const bell = (page: Page) => page.getByRole("banner").getByRole("button", { name: /^Thông báo/ });

test.describe("Thông báo nhắc hạn — tiêu chí nghiệm thu Giai đoạn 5", () => {
  test("việc còn 3 ngày → người chủ trì có thông báo sáng hôm đó (job 06:30), không trùng khi chạy lại", async ({
    page,
  }) => {
    const [lead, assigner] = await Promise.all([userId("canbo1"), userId("vanthu")]);
    const taskId = randomUUID();
    const title = `Rà soát hồ sơ hộ nghèo ${RUN}`;
    await sql(
      `INSERT INTO "Task" (id, title, "assignerId", "leadUserId", "dueDate", flow, "updatedAt")
       VALUES ($1, $2, $3, $4, $5::date, 'IN_PROGRESS', now())`,
      [taskId, title, assigner, lead, vnDay(3)],
    );

    const out = runWorker("daily", `${vnDay()}T06:30:00+07:00`);
    expect(out).toContain("Xong");
    runWorker("daily", `${vnDay()}T09:00:00+07:00`); // chạy lại trong ngày
    const rows = await sql<{ userId: string; title: string }>(
      `SELECT "userId", title FROM "Notification" WHERE link = $1`,
      [`/cong-viec/${taskId}`],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.userId).toBe(lead);

    await login(page, "canbo1");
    await expect(page.getByTestId("notification-badge")).toBeVisible({ timeout: 30_000 });
    await bell(page).click();
    const item = page.getByRole("button", { name: new RegExp(`${title}.*còn 3 ngày đến hạn`) });
    await expect(item).toBeVisible();
    const before = Number(await page.getByTestId("notification-badge").innerText());
    await item.click();
    await expect(page).toHaveURL(new RegExp(`/cong-viec/${taskId}$`));
    await expect(page.getByRole("heading", { name: title })).toBeVisible({ timeout: 30_000 });
    // Đã đọc → badge giảm
    await expect
      .poll(async () => {
        const badge = page.getByTestId("notification-badge");
        return (await badge.count()) ? Number(await badge.innerText()) : 0;
      })
      .toBe(before - 1);

    // Trang Thông báo: lọc "Chưa đọc" không còn thông báo này
    await page.goto("/thong-bao?chuaDoc=1");
    await expect(page.getByRole("heading", { level: 1, name: "Thông báo" })).toBeVisible();
    await expect(page.getByText(new RegExp(`${title}.*còn 3 ngày`))).toHaveCount(0);
  });
});

test.describe("Tìm kiếm toàn cục Ctrl+K", () => {
  test("gõ không dấu ra văn bản; Enter mở; TDP mở danh mục đã lọc", async ({ page }) => {
    await login(page, "vanthu");
    await page.goto("/viec-cua-toi");
    await page.keyboard.press("Control+k");
    const input = page.getByRole("combobox", { name: "Từ khoá tìm kiếm" });
    await expect(input).toBeFocused();
    await input.fill("quyet dinh thanh lap");
    const first = page.getByRole("option").first();
    await expect(first).toContainText(/Quyết định/i, { timeout: 30_000 });
    await expect(first.locator("mark").first()).toBeVisible(); // tô sáng từ khoá
    await input.press("Enter");
    await expect(page).toHaveURL(/\/van-ban\/[\w-]+$/);

    await page.keyboard.press("Control+k");
    await page.getByRole("combobox", { name: "Từ khoá tìm kiếm" }).fill("to dan pho so 1");
    await expect(page.getByRole("group", { name: "Tổ dân phố" })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("group", { name: "Tổ dân phố" }).getByRole("option").first().click();
    await expect(page).toHaveURL(/\/dia-ban\/to-dan-pho\?tim=/);
    await expect(
      page.getByRole("searchbox").or(page.getByPlaceholder(/Tìm tổ dân phố/)),
    ).toHaveValue(/Tổ dân phố số 1/);
  });

  test("không thấy công việc ngoài phạm vi; < 2 ký tự chỉ hiện gợi ý", async ({ page }) => {
    const [assigner, otherDept] = await Promise.all([
      userId("vanthu"),
      sql<{ id: string }>(
        `SELECT d.id FROM "Department" d WHERE d.id <> (SELECT "departmentId" FROM "User" WHERE username = 'canbo1') LIMIT 1`,
      ).then((r) => r[0]!.id),
    ]);
    await sql(
      `INSERT INTO "Task" (id, title, "assignerId", "leadDepartmentId", flow, "updatedAt")
       VALUES ($1, $2, $3, $4, 'NEW', now())`,
      [randomUUID(), `Việc bí mật đơn vị khác ${RUN}`, assigner, otherDept],
    );
    await login(page, "canbo1");
    await page
      .getByRole("banner")
      .getByRole("button", { name: /^Tìm kiếm/ })
      .first()
      .click();
    const input = page.getByRole("combobox", { name: "Từ khoá tìm kiếm" });
    await input.fill("a");
    await expect(page.getByText(/Gõ ít nhất 2 ký tự/)).toBeVisible();
    await input.fill(`viec bi mat ${RUN}`);
    await expect(page.getByText(`Không tìm thấy kết quả cho “viec bi mat ${RUN}”.`)).toBeVisible({
      timeout: 30_000,
    });
  });
});

test.describe("Nhật ký", () => {
  test("LEADER lọc theo người + hành động + ngày; OFFICER không vào được", async ({ page }) => {
    await login(page, "chutich");
    await page.goto("/quan-tri/nhat-ky");
    await expect(page.getByRole("heading", { level: 1, name: "Nhật ký" })).toBeVisible();
    await page
      .getByLabel("Người thực hiện")
      .selectOption({ label: "Chủ tịch UBND (mẫu) (chutich)" });
    await page.getByLabel("Hành động").selectOption({ label: "Đăng nhập" });
    const today = vnDay().split("-").reverse().join("/");
    await page.getByRole("textbox", { name: "Từ ngày" }).fill(today);
    await page.getByRole("button", { name: "Lọc", exact: true }).click();
    await expect(page).toHaveURL(/hanhDong=LOGIN/);
    const table = page.getByRole("table");
    await expect(table.locator("tbody tr").first()).toBeVisible();
    for (const row of await table.locator("tbody tr").all()) {
      await expect(row).toContainText("Đăng nhập");
      await expect(row).toContainText("chutich");
      await expect(row).toContainText(today);
    }
    // Ngày sai định dạng → báo lỗi bằng câu đầy đủ
    await page.getByRole("textbox", { name: "Từ ngày" }).fill("32-10");
    await page.getByRole("button", { name: "Lọc", exact: true }).click();
    // (Next.js có sẵn một vùng role=alert thông báo chuyển trang → lọc theo nội dung)
    await expect(
      page.getByRole("alert").filter({ hasText: "Từ ngày phải có dạng ngày/tháng/năm" }),
    ).toBeVisible();

    await page.context().clearCookies();
    await login(page, "canbo1");
    await page.goto("/quan-tri/nhat-ky");
    await expect(page).toHaveURL(/khong-co-quyen/);
  });
});

test.describe("Thùng rác", () => {
  test.describe.configure({ mode: "serial" });

  async function deletedProgram(title: string, daysAgo: number) {
    const id = randomUUID();
    const [admin, type] = await Promise.all([
      userId("admin"),
      sql<{ id: string }>(`SELECT id FROM "DocumentType" WHERE code = 'CTr'`).then((r) => r[0]!.id),
    ]);
    await sql(
      `INSERT INTO "DocumentNode" (id, path, depth, "typeId", title, "createdById", "updatedAt", "deletedAt")
       VALUES ($1, $2, 1, $3, $4, $5, now(), now() - make_interval(days => $6))`,
      [id, `/${id}/`, type, title, admin, daysAgo],
    );
    return id;
  }

  test("ADMIN khôi phục, xoá vĩnh viễn (xác nhận hậu quả); job đêm xoá mục quá 30 ngày", async ({
    page,
  }) => {
    const keep = await deletedProgram(`Chương trình khôi phục ${RUN}`, 2);
    const purge = await deletedProgram(`Chương trình xoá ngay ${RUN}`, 5);
    const expired = await deletedProgram(`Chương trình hết hạn ${RUN}`, 31);

    await login(page, "admin");
    await page.goto("/quan-tri/thung-rac");
    await expect(page.getByRole("heading", { level: 1, name: "Thùng rác" })).toBeVisible();
    const row = (t: string) => page.getByRole("row").filter({ hasText: t });
    await expect(row(`Chương trình khôi phục ${RUN}`)).toContainText("Còn 28 ngày");

    await row(`Chương trình khôi phục ${RUN}`).getByRole("button", { name: "Khôi phục" }).click();
    await expect(page.getByText("Đã khôi phục 1 văn bản.")).toBeVisible();
    await expect(row(`Chương trình khôi phục ${RUN}`)).toHaveCount(0);
    expect(
      (await sql(`SELECT 1 FROM "DocumentNode" WHERE id = $1 AND "deletedAt" IS NULL`, [keep]))
        .length,
    ).toBe(1);

    await row(`Chương trình xoá ngay ${RUN}`)
      .getByRole("button", { name: "Xoá vĩnh viễn" })
      .click();
    const dialog = page.getByRole("alertdialog").or(page.getByRole("dialog"));
    await expect(dialog).toContainText("Không khôi phục được");
    await dialog.getByRole("button", { name: "Xoá vĩnh viễn" }).click();
    await expect(page.getByText("Đã xoá vĩnh viễn.")).toBeVisible({ timeout: 30_000 });
    await expect(dialog).toBeHidden();
    await expect(row(`Chương trình xoá ngay ${RUN}`)).toHaveCount(0);
    expect(await sql(`SELECT 1 FROM "DocumentNode" WHERE id = $1`, [purge])).toHaveLength(0);

    // Job đêm: mục xoá 31 ngày trước bị xoá vĩnh viễn, ghi nhật ký "Xoá vĩnh viễn" của hệ thống
    runWorker("nightly", new Date().toISOString());
    expect(await sql(`SELECT 1 FROM "DocumentNode" WHERE id = $1`, [expired])).toHaveLength(0);
    await page.goto(`/quan-tri/nhat-ky?hanhDong=PURGE&ma=${expired}`);
    await expect(page.getByRole("table")).toContainText("Hệ thống (tự động)");
    await expect(page.getByRole("table")).toContainText(`Chương trình hết hạn ${RUN}`);
  });

  test("chỉ ADMIN vào được Thùng rác", async ({ page }) => {
    await login(page, "chutich");
    await page.goto("/quan-tri/thung-rac");
    await expect(page).toHaveURL(/khong-co-quyen/);
  });
});
