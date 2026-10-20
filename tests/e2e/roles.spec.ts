import { expect, test } from "@playwright/test";

import { login, sidebarLinks } from "./helpers";

// Menu mong đợi theo bảng phân quyền Mục 12 (Mục 8.2.6)
const CORE = ["Bảng điều hành", "Việc của tôi", "Văn bản", "Theo dõi báo cáo", "Công việc"];
const AREA = ["Thông tin phường", "Trường học", "Tổ dân phố", "Tổ chức đảng"];

const ROLES = [
  {
    username: "admin",
    role: "ADMIN",
    home: "/",
    menu: [...CORE, ...AREA, "Người dùng", "Đơn vị", "Danh mục", "Nhật ký", "Thùng rác"],
  },
  { username: "chutich", role: "LEADER", home: "/", menu: [...CORE, ...AREA, "Nhật ký"] },
  { username: "vanthu", role: "CLERK", home: "/", menu: [...CORE, ...AREA] },
  { username: "canbo1", role: "OFFICER", home: "/viec-cua-toi", menu: [...CORE, ...AREA] },
  { username: "xaydungdang", role: "PARTY_ADMIN", home: "/", menu: [...CORE, ...AREA] },
  {
    username: "totruong1",
    role: "VIEWER",
    home: "/",
    menu: ["Bảng điều hành", "Văn bản", ...AREA],
  },
] as const;

// Nút quản lý trên trang danh mục (Mục 12: "Danh mục trường, TDP", "Danh mục tổ chức đảng", "Thông tin phường")
const MANAGE: Record<string, { tdp: boolean; party: boolean; ward: boolean }> = {
  ADMIN: { tdp: true, party: true, ward: true },
  LEADER: { tdp: false, party: false, ward: false },
  CLERK: { tdp: true, party: false, ward: false },
  OFFICER: { tdp: false, party: false, ward: false },
  PARTY_ADMIN: { tdp: false, party: true, ward: false },
  VIEWER: { tdp: false, party: false, ward: false },
};

test.describe("Phân quyền theo vai trò (Mục 12)", () => {
  for (const r of ROLES) {
    test(`${r.role} (${r.username}): trang mặc định, menu và quyền sửa danh mục`, async ({
      page,
    }) => {
      await login(page, r.username);
      await expect(page).toHaveURL(new RegExp(`${r.home === "/" ? "/$" : r.home}`));

      expect(await sidebarLinks(page)).toEqual(r.menu);

      const m = MANAGE[r.role]!;
      await page.goto("/dia-ban/to-dan-pho");
      await expect(page.getByRole("heading", { level: 1, name: "Tổ dân phố" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Thêm tổ dân phố" })).toHaveCount(
        m.tdp ? 1 : 0,
      );
      await expect(page.getByRole("button", { name: "Nhập Excel" })).toHaveCount(m.tdp ? 1 : 0);
      await expect(page.getByRole("link", { name: "Xuất Excel" })).toBeVisible();

      await page.goto("/dia-ban/to-chuc-dang");
      await expect(page.getByRole("button", { name: "Thêm tổ chức đảng" })).toHaveCount(
        m.party ? 1 : 0,
      );

      await page.goto("/dia-ban/thong-tin-phuong");
      await expect(page.getByRole("button", { name: "Sửa thông tin" })).toHaveCount(m.ward ? 1 : 0);

      // Trang quản trị: chỉ ADMIN
      await page.goto("/quan-tri/nguoi-dung");
      if (r.role === "ADMIN")
        await expect(page.getByRole("heading", { level: 1, name: "Người dùng" })).toBeVisible();
      else await expect(page.getByText("Không có quyền truy cập")).toBeVisible();

      // Nhật ký: ADMIN, LEADER
      await page.goto("/quan-tri/nhat-ky");
      const auditAllowed = r.role === "ADMIN" || r.role === "LEADER";
      await expect(page.getByText("Không có quyền truy cập")).toHaveCount(auditAllowed ? 0 : 1);

      // VIEWER không vào được Công việc
      await page.goto("/cong-viec");
      await expect(page.getByText("Không có quyền truy cập")).toHaveCount(
        r.role === "VIEWER" ? 1 : 0,
      );
    });
  }

  test("API xuất Excel cũng kiểm tra quyền: VIEWER không xuất được danh sách người dùng", async ({
    page,
  }) => {
    await login(page, "totruong1");
    const denied = await page.request.get("/api/export/users");
    expect(denied.status()).toBe(403);
    const ok = await page.request.get("/api/export/residentials");
    expect(ok.status()).toBe(200);
    expect(ok.headers()["content-type"]).toContain("spreadsheetml");
  });

  test("chưa đăng nhập → chuyển về trang đăng nhập, đăng nhập xong quay lại đúng trang; API trả 401", async ({
    page,
  }) => {
    expect((await page.request.get("/api/export/schools")).status()).toBe(401);
    await page.goto("/dia-ban/truong-hoc?namHoc=2025-2026");
    await expect(page).toHaveURL(/\/dang-nhap\?.*callbackUrl=/);
    await page.getByLabel("Tên đăng nhập").fill("vanthu");
    await page.getByRole("textbox", { name: "Mật khẩu", exact: true }).fill("ThanhLiet@2026");
    await page.getByRole("button", { name: "Đăng nhập" }).click();
    await expect(page).toHaveURL(/\/dia-ban\/truong-hoc\?namHoc=2025-2026$/);
  });
});

test.describe("Đăng nhập & mật khẩu (Mục 13.2)", () => {
  test("sai mật khẩu báo lỗi chung; sai 5 lần thì khoá tài khoản", async ({ page }) => {
    await page.goto("/dang-nhap");
    const submit = page.getByRole("button", { name: "Đăng nhập" });
    for (let i = 1; i <= 5; i++) {
      // React đặt lại form khi action trước kết thúc → chờ nút bật lại rồi mới điền
      await expect(submit).toBeEnabled();
      await page.getByLabel("Tên đăng nhập").fill("thukhoa");
      await page.getByRole("textbox", { name: "Mật khẩu", exact: true }).fill(`sai-mat-khau-${i}`);
      // Chờ từng lần gửi xong (thông báo lỗi các lần giống nhau nên không dựa vào chữ hiển thị được)
      await Promise.all([
        page.waitForResponse(
          (r) => r.request().method() === "POST" && r.url().includes("/dang-nhap"),
        ),
        page.getByRole("button", { name: "Đăng nhập" }).click(),
      ]);
      if (i < 5)
        await expect(page.getByText("Tên đăng nhập hoặc mật khẩu không đúng.")).toBeVisible();
      else
        await expect(page.getByText(/Tài khoản tạm khoá do nhập sai mật khẩu 5 lần/)).toBeVisible();
    }
    // Mật khẩu đúng cũng bị từ chối khi đang khoá
    await expect(submit).toBeEnabled();
    await page.getByRole("textbox", { name: "Mật khẩu", exact: true }).fill("ThanhLiet@2026");
    await page.getByRole("button", { name: "Đăng nhập" }).click();
    await expect(page.getByText(/Tài khoản tạm khoá/)).toBeVisible();
  });

  test("lần đầu đăng nhập bắt đổi mật khẩu, kiểm tra quy tắc rồi vào Việc của tôi", async ({
    page,
  }) => {
    await login(page, "canbo2");
    await expect(page).toHaveURL(/\/doi-mat-khau$/);
    // Chưa đổi thì không vào được trang khác
    await page.goto("/dia-ban/truong-hoc");
    await expect(page).toHaveURL(/\/doi-mat-khau$/);

    await page.getByLabel("Mật khẩu hiện tại").fill("ThanhLiet@2026");
    await page.getByRole("textbox", { name: "Mật khẩu mới", exact: true }).fill("abcdefgh");
    await page.getByLabel("Nhập lại mật khẩu mới").fill("abcdefgh");
    await page.getByRole("button", { name: "Đổi mật khẩu" }).click();
    await expect(page.getByText("Mật khẩu phải có ít nhất một chữ số.")).toBeVisible();

    await page.getByRole("textbox", { name: "Mật khẩu mới", exact: true }).fill("MatKhauMoi2026");
    await page.getByLabel("Nhập lại mật khẩu mới").fill("MatKhauMoi2026");
    await page.getByRole("button", { name: "Đổi mật khẩu" }).click();
    await expect(page).toHaveURL(/\/viec-cua-toi$/);
  });

  test("đăng xuất", async ({ page }) => {
    await login(page, "chutich");
    await page.getByRole("button", { name: /Tài khoản:/ }).click();
    await page.getByTestId("logout").click();
    await expect(page).toHaveURL(/\/dang-nhap/);
    await page.goto("/");
    await expect(page).toHaveURL(/\/dang-nhap/);
  });
});
