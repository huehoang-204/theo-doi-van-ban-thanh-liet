import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";
import JSZip from "jszip";
import { Client } from "pg";

import { e2eDatabaseUrl } from "./env";
import { login } from "./helpers";

// GĐ5b — ban hành văn bản tới đơn vị, thông báo "… đã ban hành văn bản …", xem trước Word, thảo luận
test.describe.configure({ mode: "serial" });

const RUN = randomUUID().slice(0, 5);
const TITLE = `Chương trình tuyên truyền ban hành thử ${RUN}`;
const NUMBER = `9${RUN.replace(/\D/g, "").slice(0, 2) || "1"}/KH-UBND`;
let docId = "";

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

async function docx(lines: string[]): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${lines
      .map((t) => `<w:p><w:r><w:t xml:space="preserve">${t}</w:t></w:r></w:p>`)
      .join("")}<w:sectPr/></w:body></w:document>`,
  );
  return zip.generateAsync({ type: "nodebuffer" });
}

const bell = (page: Page) => page.getByRole("banner").getByRole("button", { name: /^Thông báo/ });

test.beforeAll(async () => {
  docId = randomUUID();
  const [vanthu, type] = await Promise.all([
    sql<{ id: string }>(`SELECT id FROM "User" WHERE username = 'vanthu'`),
    sql<{ id: string }>(`SELECT id FROM "DocumentType" WHERE code = 'CTr'`),
  ]);
  await sql(
    `INSERT INTO "DocumentNode" (id, path, depth, "typeId", number, title, "createdById", "updatedAt", "issuedDate")
     VALUES ($1, $2, 1, $3, $4, $5, $6, now(), '2026-10-15')`,
    [docId, `/${docId}/`, type[0]!.id, NUMBER, TITLE, vanthu[0]!.id],
  );
});

test("văn thư ban hành tới đơn vị → cán bộ có thông báo, mở văn bản, xem trước Word, thảo luận", async ({
  browser,
}) => {
  // ---- Văn thư: đính kèm tệp Word rồi ban hành tới Phòng Kinh tế
  const clerk = await (await browser.newContext()).newPage();
  await login(clerk, "vanthu");
  await clerk.goto(`/van-ban/${docId}`);
  await expect(clerk.getByRole("heading", { name: /^Tệp tin đính kèm/ })).toBeVisible({
    timeout: 60_000,
  });
  await clerk.getByLabel("Tải tệp lên").setInputFiles({
    name: "ke-hoach-tuyen-truyen.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: await docx([
      "KẾ HOẠCH TUYÊN TRUYỀN",
      `Mã thử ${RUN}: tuyên truyền chuyển đổi số tới từng tổ dân phố.`,
    ]),
  });
  await expect(clerk.getByText("Đã tải lên 1 tệp.")).toBeVisible();

  await clerk.getByRole("button", { name: "Ban hành / Gửi" }).click();
  const dialog = clerk.getByRole("dialog");
  await dialog.getByRole("button", { name: "Ban hành" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Hãy chọn người nhận"); // chưa chọn ai
  await dialog.getByRole("checkbox", { name: /^Phòng Kinh tế, Hạ tầng và Đô thị/ }).click();
  await expect(dialog.getByText(/Sẽ gửi tới \d+ người/)).toBeVisible();
  await dialog
    .getByLabel("Lời gửi kèm")
    .fill(`Kính gửi: Phòng Kinh tế, Hạ tầng và Đô thị.\nĐề nghị triển khai (${RUN}).`);
  await dialog.getByRole("button", { name: "Ban hành" }).click();
  await expect(clerk.getByText(/Đã ban hành tới \d+ người/)).toBeVisible();
  await expect(clerk.getByText(/^Đã ban hành \d{2}\/\d{2}\/\d{4}/)).toBeVisible();
  await expect(clerk.getByRole("button", { name: "Gửi bổ sung" })).toBeVisible();

  // ---- Cán bộ Phòng Kinh tế
  const officer = await (await browser.newContext()).newPage();
  await login(officer, "canbo1");
  await expect(officer.getByTestId("notification-badge")).toBeVisible({ timeout: 30_000 });
  await bell(officer).click();
  const note = officer.getByRole("button", {
    name: new RegExp(
      `VĂN PHÒNG HĐND VÀ UBND đã ban hành văn bản ${TITLE} \\[${NUMBER.replace("/", "\\/")}\\]`,
    ),
  });
  await expect(note).toBeVisible();
  await note.click();
  await expect(officer).toHaveURL(new RegExp(`/van-ban/${docId}`));
  await expect(officer.getByText(`Đề nghị triển khai (${RUN}).`)).toBeVisible({ timeout: 60_000 });
  // Xem trước Word ngay trên trang
  await expect(officer.locator(".docx-host")).toContainText(`Mã thử ${RUN}`, { timeout: 30_000 });
  // Cột thông tin: người nhận, đã xem
  const aside = officer.getByRole("complementary", { name: "Thông tin văn bản" });
  await expect(aside).toContainText("Phòng Kinh tế, Hạ tầng và Đô thị");
  await expect(aside).toContainText(/Đã xem \(2\)/); // văn thư (người gửi) + cán bộ
  await expect(aside).toContainText("1/1 người nhận đã xem");

  // Thảo luận
  await officer
    .getByLabel("Nội dung thảo luận")
    .fill(`Phòng Kinh tế đã nhận, sẽ triển khai ${RUN}.`);
  await officer.getByRole("button", { name: "Gửi thảo luận" }).click();
  await expect(officer.getByText("Đã gửi thảo luận.")).toBeVisible();
  await expect(officer.getByRole("heading", { name: "Thảo luận (1)" })).toBeVisible();

  // ---- Văn thư (người ban hành, tự theo dõi) được báo có thảo luận
  await clerk.reload();
  await bell(clerk).click();
  await expect(
    clerk.getByRole("button", {
      name: new RegExp(`Cán bộ Kinh tế \\(mẫu\\) thảo luận trong .*đã nhận, sẽ triển khai ${RUN}`),
    }),
  ).toBeVisible({ timeout: 30_000 });
});

test("Mới ban hành: cán bộ thấy văn bản gửi đến mình theo ngày; đã xem thì hết “Chưa xem”", async ({
  page,
}) => {
  await login(page, "canbo1");
  await page.goto("/van-ban/ban-hanh");
  const item = page.getByRole("link", { name: new RegExp(TITLE) });
  await expect(item).toBeVisible({ timeout: 60_000 });
  await expect(item).toContainText("VĂN PHÒNG HĐND VÀ UBND".toLowerCase(), { ignoreCase: true });
  await page.goto("/van-ban/ban-hanh?loc=chua-xem");
  await expect(page.getByRole("link", { name: new RegExp(TITLE) })).toHaveCount(0);
});

test("người chỉ xem (VIEWER) được gửi đích danh thì xem được chi tiết; không được gửi thì không", async ({
  page,
}) => {
  await login(page, "totruong1");
  // Seed: 88/UBND-VP gửi đích danh tổ trưởng TDP số 1
  const [d88] = await sql<{ id: string }>(
    `SELECT id FROM "DocumentNode" WHERE number = '88/UBND-VP'`,
  );
  await page.goto(`/van-ban/${d88!.id}`);
  await expect(page.getByRole("heading", { name: /^Tệp tin đính kèm/ })).toBeVisible({
    timeout: 60_000,
  });
  await page.goto(`/van-ban/${docId}`);
  await expect(page.getByText("Bạn không có quyền xem chi tiết văn bản này")).toBeVisible();
});
