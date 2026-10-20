// Seed khởi tạo — chạy được nhiều lần (upsert). Giai đoạn 1 bổ sung danh mục & dữ liệu mẫu Mục 15
// (dữ liệu minh hoạ tách ở seed-sample.ts, đánh dấu isSample để dễ xoá trước khi bàn giao).
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient, type Prisma } from "../src/generated/prisma/client";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// Cấu hình mặc định (Mục 10 — Setting)
const DEFAULT_SETTINGS: Record<string, Prisma.InputJsonValue> = {
  dueSoonDays: 3,
  maxTreeDepth: 5,
  currentSchoolYear: "2026-2027",
  maxUploadMB: 20,
};

async function main() {
  // Thông tin phường — số liệu nền do phường cung cấp (Mục 1.1, 6.1, 15)
  await db.wardProfile.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: "Phường Thanh Liệt",
      city: "Hà Nội",
      areaKm2: "6.44",
      population: 92000,
      populationIsEstimate: true,
      establishedDate: new Date("2025-07-01T00:00:00Z"),
      partyOrgCountOverride: 63,
    },
  });

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await db.setting.upsert({
      where: { key },
      update: {},
      create: { key, value },
    });
  }

  console.log("Đã seed: Thông tin phường, cấu hình mặc định.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
