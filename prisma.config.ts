import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  // Không dùng env("DATABASE_URL"): hàm này báo lỗi ngay khi thiếu biến, kể cả với `prisma generate`
  // (bước build trên Render/CI không cần CSDL). Lệnh migrate/seed vẫn báo lỗi rõ nếu thiếu URL.
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
