import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";

import { e2eDatabaseUrl } from "./env";
import { login } from "./helpers";

// Giai đoạn 4 — Bảng điều hành (Mục 7). Số liệu so trực tiếp với CSDL E2E.
const vi = (x: number) => new Intl.NumberFormat("vi-VN").format(x);

async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const c = new Client({ connectionString: e2eDatabaseUrl() });
  await c.connect();
  try {
    return (await c.query(sql, params)).rows as T[];
  } finally {
    await c.end();
  }
}

const tileValue = (page: Page, id: string) => page.getByTestId(id).locator("[data-value]");

async function openDashboard(page: Page, user: string) {
  await login(page, user);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: /Bảng điều hành/i })).toBeVisible({
    timeout: 60_000,
  });
}

test.describe("Bảng điều hành — tiêu chí nghiệm thu Giai đoạn 4", () => {
  test("/api/dashboard trả đủ 5 khối trong một lần gọi", async ({ page }) => {
    await login(page, "chutich");
    const res = await page.request.get("/api/dashboard");
    expect(res.ok()).toBe(true);
    const body = await res.json();
    for (const key of ["ward", "residential", "party", "education", "operations"])
      expect(body, key).toHaveProperty(key);
    expect(body.operations.tasks).toEqual(
      expect.objectContaining({ overdue: expect.any(Number), done: expect.any(Number) }),
    );
    // Năm học khác qua tham số
    const other = await (await page.request.get("/api/dashboard?schoolYear=2025-2026")).json();
    expect(other.education.schoolYear).toBe("2025-2026");
  });

  test("số trên thẻ khớp danh mục; tổ chức đảng dùng số nhập tay khi có", async ({ page }) => {
    await openDashboard(page, "chutich");
    // catalog.spec nhập 60 TDP song song → đọc CSDL rồi tải lại trang tới khi hai bên cùng thời điểm
    await expect(async () => {
      const [res] = await query<{ n: number; hh: number; pop: number }>(
        `SELECT count(*)::int n, coalesce(sum(households),0)::int hh, coalesce(sum(population),0)::int pop
         FROM "Residential" WHERE active`,
      );
      await page.reload();
      await expect(tileValue(page, "tile-residentials")).toHaveText(vi(res!.n), { timeout: 2000 });
      await expect(page.getByTestId("tile-residentials")).toContainText(
        `${vi(res!.hh)} hộ · ${vi(res!.pop)} nhân khẩu`,
        { timeout: 2000 },
      );
    }).toPass({ timeout: 30_000 });

    const [sch] = await query<{ n: number }>(`SELECT count(*)::int n FROM "School" WHERE active`);
    await expect(tileValue(page, "tile-schools")).toHaveText(vi(sch!.n));

    const api = await (await page.request.get("/api/dashboard")).json();
    const year: string = api.education.schoolYear;
    const [stu] = await query<{ s: number; st: number }>(
      `SELECT coalesce(sum(y.students),0)::int s, coalesce(sum(y."staffTotal"),0)::int st
       FROM "SchoolYearStat" y JOIN "School" s ON s.id = y."schoolId" WHERE s.active AND y."schoolYear" = $1`,
      [year],
    );
    await expect(tileValue(page, "tile-students")).toHaveText(vi(stu!.s));
    await expect(page.getByTestId("tile-students")).toContainText(`CB-GV-NV: ${vi(stu!.st)}`);

    // Tổ chức đảng: seed đặt override 63 → hiện 63 + "Số nhập tay"; chi bộ không override → đếm danh mục
    const [ward] = await query<{ o: number | null; c: number | null }>(
      `SELECT "partyOrgCountOverride" o, "partyCellCountOverride" c FROM "WardProfile" LIMIT 1`,
    );
    expect(ward!.o).not.toBeNull();
    await expect(tileValue(page, "tile-party-orgs")).toHaveText(vi(ward!.o!));
    await expect(page.getByTestId("tile-party-orgs")).toContainText("Số nhập tay");
    expect(ward!.c).toBeNull();
    await expect(page.getByTestId("tile-party-cells")).not.toContainText("Số nhập tay");
    await expect(tileValue(page, "tile-party-cells")).toHaveText(vi(api.party.cells.value));

    // "Cập nhật ngày …" ở tiêu đề từng khối (Mục 7.1); từng thẻ ghi trong title
    await expect(page.getByRole("region", { name: "Số liệu địa bàn" })).toContainText(
      /Cập nhật ngày \d{2}\/\d{2}\/\d{4}/,
    );
    for (const id of ["tile-area", "tile-population", "tile-residentials", "tile-students"])
      await expect(page.getByTestId(id)).toHaveAttribute(
        "title",
        /cập nhật ngày \d{2}\/\d{2}\/\d{4}/,
      );
    await expect(page.getByTestId("tile-population")).toContainText(/Mật độ ≈ [\d.]+ người\/km²/);
  });

  test("bấm thẻ “Quá hạn” → danh sách công việc quá hạn đúng số lượng", async ({ page }) => {
    await openDashboard(page, "chutich");
    const tile = page.getByTestId("ops-overdue");
    const count = Number((await tile.locator("[data-value]").innerText()).replace(/\./g, ""));
    expect(count).toBeGreaterThan(0);
    await tile.click();
    await expect(page).toHaveURL(/\/cong-viec\?trangThai=QUA_HAN/);
    await expect(page.getByText(`${vi(count)} dòng`, { exact: true })).toBeVisible({
      timeout: 60_000,
    });
    const rows = page.getByRole("table").locator("tbody tr");
    await expect(rows).toHaveCount(Math.min(count, 20));
    for (const r of await rows.all()) await expect(r).toContainText("Quá hạn");
  });

  test("cột biểu đồ bấm được, chọn năm học đổi số liệu Giáo dục", async ({ page }) => {
    await openDashboard(page, "chutich");
    const [old] = await query<{ s: number }>(
      `SELECT coalesce(sum(y.students),0)::int s FROM "SchoolYearStat" y JOIN "School" s ON s.id = y."schoolId"
       WHERE s.active AND y."schoolYear" = '2025-2026'`,
    );
    await page.getByRole("combobox", { name: "Chọn năm học" }).selectOption("2025-2026");
    await expect(tileValue(page, "tile-students")).toHaveText(vi(old!.s));
    await expect(page.getByTestId("tile-students")).toContainText("năm học 2025-2026");

    await page
      .getByRole("region", { name: "Giáo dục" })
      .locator(".recharts-bar-rectangle")
      .first()
      .click();
    await expect(page).toHaveURL(/\/dia-ban\/truong-hoc\?capHoc=\w+&namHoc=2025-2026/);
  });

  test("biểu đồ xu hướng & báo cáo theo tháng: bấm cột ra danh sách lọc theo tháng", async ({
    page,
  }) => {
    await openDashboard(page, "chutich");
    const api = await (await page.request.get("/api/dashboard")).json();
    expect(api.operations.trend).toHaveLength(6);
    expect(api.operations.reportMonths).toHaveLength(6);
    const month = api.operations.trend.at(-1).key as string; // tháng hiện tại
    const [row] = await query<{ n: number }>(
      `SELECT count(*)::int n FROM "Task" WHERE "deletedAt" IS NULL AND flow <> 'CANCELLED'
       AND to_char("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM') = $1`,
      [month],
    );
    expect(api.operations.trend.at(-1).assigned).toBe(row!.n);

    // Bấm cột "Giao mới" tháng hiện tại → /cong-viec?giao=YYYY-MM, có chip lọc tháng
    const trend = page.getByRole("region", { name: /Giao mới và hoàn thành/ });
    // Chuỗi đầu (Giao mới), cột cuối = tháng hiện tại (cột giá trị 0 không được vẽ)
    await trend.locator(".recharts-bar").first().locator(".recharts-bar-rectangle").last().click();
    await expect(page).toHaveURL(new RegExp(`/cong-viec\\?giao=${month}`));
    const [y, m] = month.split("-");
    await expect(page.getByText(`Giao trong tháng ${m}/${y}`)).toBeVisible({ timeout: 60_000 });

    // Báo cáo theo tháng: liên kết ẩn (bàn phím/trình đọc màn hình) dẫn tới /bao-cao?thang=…&trangThai=QUA_HAN
    await page.goBack();
    const link = page
      .getByRole("region", { name: /Nộp báo cáo theo tháng/ })
      .getByRole("link", { name: /^Quá hạn chưa nộp/ })
      .first();
    const href = await link.getAttribute("href");
    expect(href).toMatch(/^\/bao-cao\?thang=\d{4}-\d{2}&trangThai=QUA_HAN$/);
    await page.goto(href!);
    await expect(page.getByText(/Hạn nộp trong tháng \d{2}\/\d{4}/)).toBeVisible({
      timeout: 60_000,
    });
  });

  test("dashboard theo vai trò: cán bộ rút gọn + Việc của tôi; người xem không có khối nhiệm vụ", async ({
    page,
  }) => {
    await openDashboard(page, "canbo1");
    await expect(page.getByRole("heading", { name: "Việc của tôi" })).toBeVisible();
    await expect(page.getByTestId("tile-area")).toBeVisible();
    await expect(page.getByTestId("tile-students")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Trình chiếu" })).toHaveCount(0);
    await expect(page.getByTestId("ops-overdue")).toHaveCount(0);

    await page.context().clearCookies();
    await openDashboard(page, "totruong1");
    await expect(page.getByTestId("tile-students")).toBeVisible();
    await expect(page.getByTestId("ops-overdue")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Việc của tôi" })).toHaveCount(0);
  });

  test("/trinh-chieu: toàn màn hình, chữ to hơn, tự làm mới 5 phút", async ({ page }) => {
    await login(page, "chutich");
    await page.goto("/trinh-chieu");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/tự làm mới 5 phút/)).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Menu chính" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Toàn màn hình" })).toBeVisible();
    // Hệ số chữ đặt sau khi hydrate (useEffect) → chờ
    await expect
      .poll(() =>
        page.evaluate(() =>
          Number(getComputedStyle(document.documentElement).getPropertyValue("--font-scale")),
        ),
      )
      .toBeGreaterThan(1);
    await expect(page.getByTestId("ops-overdue")).toBeVisible();
  });
});
