// Chuẩn bị CSDL E2E: tạo DB nếu chưa có → migrate → seed (lõi + mẫu) → đưa tài khoản thử về trạng thái biết trước.
// Dùng `pg` + SQL trực tiếp (Prisma client sinh ra là ESM, không nạp được trong global setup của Playwright).
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import bcrypt from "bcryptjs";
import { Client } from "pg";

import { e2eDatabaseUrl, TEST_PASSWORD } from "./env";

export default async function globalSetup() {
  const url = e2eDatabaseUrl();
  const dbName = new URL(url).pathname.slice(1);

  const admin = new Client({ connectionString: process.env.DATABASE_URL });
  await admin.connect();
  const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
  if (exists.rowCount === 0) await admin.query(`CREATE DATABASE "${dbName}"`);
  await admin.end();

  const env = { ...process.env, DATABASE_URL: url };
  execSync("npx prisma migrate deploy", { env, stdio: "pipe" });
  // Dữ liệu mẫu dựng lại mỗi lần chạy → cây văn bản/công việc luôn ở trạng thái biết trước
  const reset = new Client({ connectionString: url });
  await reset.connect();
  await reset.query(
    `TRUNCATE "DocumentNode", "Task", "ReportRequirement", "Attachment", "Notification" CASCADE`,
  );
  await reset.end();
  execSync("npx tsx prisma/clear-sample.ts", { env, stdio: "pipe" });
  execSync("npx tsx prisma/seed.ts", { env, stdio: "pipe" });

  const db = new Client({ connectionString: url });
  await db.connect();
  const hash = await bcrypt.hash(TEST_PASSWORD, 4); // cost thấp cho nhanh — chỉ dùng trong test
  await db.query(
    `UPDATE "User" SET "passwordHash" = $1, "mustChangePassword" = false, "failedLoginCount" = 0,
       "lockedUntil" = NULL, active = true, "fontScale" = 100
     WHERE "isSample" OR username = 'admin'`,
    [hash],
  );
  // canbo2: kiểm thử bắt đổi mật khẩu lần đầu
  await db.query(`UPDATE "User" SET "mustChangePassword" = true WHERE username = 'canbo2'`);
  // Tài khoản riêng cho kiểm thử khoá sau 5 lần sai
  await db.query(
    `INSERT INTO "User" (id, username, "fullName", roles, "passwordHash", "mustChangePassword", "isSample", "updatedAt")
     VALUES ($1, 'thukhoa', 'Tài khoản thử khoá', ARRAY['VIEWER']::"Role"[], $2, false, true, now())
     ON CONFLICT (username) DO UPDATE SET "passwordHash" = $2, "failedLoginCount" = 0, "lockedUntil" = NULL`,
    [randomUUID(), hash],
  );
  // Dữ liệu do test nhập ở lần chạy trước
  await db.query(`DELETE FROM "Residential" WHERE name LIKE 'TDP nhập thử%'`);
  await db.query(`DELETE FROM "Department" WHERE name LIKE 'Đơn vị thử nghiệm%'`);
  await db.end();
}
