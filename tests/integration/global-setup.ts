// CSDL riêng cho integration test: <db>_test — tạo nếu chưa có, migrate, seed lõi (không dữ liệu mẫu).
import { execSync } from "node:child_process";

import "dotenv/config";
import { Client } from "pg";

export function testDatabaseUrl(): string {
  const url = new URL(process.env.DATABASE_URL ?? "");
  url.pathname = `${url.pathname}_test`;
  return url.toString();
}

export default async function setup() {
  const url = testDatabaseUrl();
  const name = new URL(url).pathname.slice(1);
  const admin = new Client({ connectionString: process.env.DATABASE_URL });
  await admin.connect();
  if ((await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [name])).rowCount === 0) {
    await admin.query(`CREATE DATABASE "${name}"`);
  }
  await admin.end();
  const env = { ...process.env, DATABASE_URL: url, SEED_SAMPLE: "0" };
  execSync("npx prisma migrate deploy", { env, stdio: "pipe" });
  execSync("npx tsx prisma/seed.ts", { env, stdio: "pipe" });
}
