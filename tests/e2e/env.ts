// Cấu hình chung cho E2E: CSDL riêng (tên DB + "_e2e") để không đụng dữ liệu dev.
import "dotenv/config";

export const E2E_PORT = Number(process.env.E2E_PORT ?? 3251);
export const TEST_PASSWORD = "ThanhLiet@2026";

export function e2eDatabaseUrl(): string {
  const url = new URL(process.env.DATABASE_URL ?? "");
  url.pathname = `${url.pathname}_e2e`;
  return url.toString();
}
