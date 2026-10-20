// Xoá toàn bộ dữ liệu MINH HOẠ (isSample = true) — chạy trước khi bàn giao: `npm run db:clear-sample`.
// Giữ nguyên dữ liệu lõi (danh mục, admin, Đảng bộ phường) và mọi dữ liệu do người dùng nhập.
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const summary = await db.$transaction(async (tx) => {
    const tasks = await tx.task.deleteMany({ where: { isSample: true } });
    const requirements = await tx.reportRequirement.deleteMany({ where: { isSample: true } });
    // Văn bản: xoá từ cấp sâu nhất lên (khoá ngoại cha–con)
    let documents = 0;
    for (let depth = 10; depth >= 1; depth--) {
      documents += (await tx.documentNode.deleteMany({ where: { isSample: true, depth } })).count;
    }
    await tx.residential.updateMany({
      where: { partyOrg: { isSample: true } },
      data: { partyOrgId: null },
    });
    let partyOrgs = 0;
    for (let i = 0; i < 3; i++) {
      // con trước, cha sau
      partyOrgs += (
        await tx.partyOrg.deleteMany({ where: { isSample: true, children: { none: {} } } })
      ).count;
    }
    const residentials = await tx.residential.deleteMany({ where: { isSample: true } });
    const schools = await tx.school.deleteMany({ where: { isSample: true } });
    const users = await tx.user.deleteMany({ where: { isSample: true } });
    return {
      tasks: tasks.count,
      requirements: requirements.count,
      documents,
      partyOrgs,
      residentials: residentials.count,
      schools: schools.count,
      users: users.count,
    };
  });
  console.log("✔ Đã xoá dữ liệu mẫu:", summary);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
