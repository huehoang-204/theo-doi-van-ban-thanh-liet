// Seed LÕI — dữ liệu thật/khởi tạo, an toàn cho production, chạy lại được nhiều lần (upsert, không ghi đè chỉnh sửa).
// Dữ liệu MINH HOẠ (Mục 15) nằm ở seed-sample.ts; bỏ qua bằng SEED_SAMPLE=0, xoá bằng `npm run db:clear-sample`.
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import { BCRYPT_COST } from "../src/lib/password";
import { seedSample } from "./seed-sample";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const DEFAULT_SETTINGS: Record<string, Prisma.InputJsonValue> = {
  dueSoonDays: 3,
  maxTreeDepth: 5,
  currentSchoolYear: "2026-2027",
  maxUploadMB: 20,
};

// Mục 15 — [CẦN XÁC NHẬN] danh sách chính xác (docs/cau-hoi-mo.md 16.5)
export const DEPARTMENTS = [
  ["Văn phòng Đảng ủy", "VP Đảng ủy"],
  ["Ban Xây dựng Đảng", "Ban XD Đảng"],
  ["Ủy ban Kiểm tra Đảng ủy", "UBKT"],
  ["Ủy ban MTTQ phường", "MTTQ"],
  ["Văn phòng HĐND và UBND", "VP HĐND-UBND"],
  ["Phòng Kinh tế, Hạ tầng và Đô thị", "Phòng KT-HT-ĐT"],
  ["Phòng Văn hóa – Xã hội", "Phòng VH-XH"],
  ["Trung tâm Phục vụ hành chính công", "TT PVHCC"],
  ["Công an phường", "CA phường"],
  ["Ban Chỉ huy Quân sự phường", "BCH QS"],
] as const;

// Mục 4.2 — mã viết tắt theo Nghị định 30/2020/NĐ-CP (Chương trình: CTr để không trùng Chỉ thị: CT)
const DOCUMENT_TYPES: {
  code: string;
  name: string;
  color: string;
  icon: string;
  isProgram?: boolean;
}[] = [
  { code: "CTr", name: "Chương trình", color: "#1E3A8A", icon: "folder-kanban", isProgram: true },
  { code: "NQ", name: "Nghị quyết", color: "#B91C1C", icon: "landmark" },
  { code: "CT", name: "Chỉ thị", color: "#9D174D", icon: "megaphone" },
  { code: "KL", name: "Kết luận", color: "#7C2D12", icon: "gavel" },
  { code: "QD", name: "Quyết định", color: "#6D28D9", icon: "stamp" },
  { code: "KH", name: "Kế hoạch", color: "#1D4ED8", icon: "calendar-range" },
  { code: "CV", name: "Công văn", color: "#0F766E", icon: "mail" },
  { code: "TB", name: "Thông báo", color: "#0369A1", icon: "bell" },
  { code: "HD", name: "Hướng dẫn", color: "#15803D", icon: "book-open" },
  { code: "QC", name: "Quy chế", color: "#4D7C0F", icon: "scale" },
  { code: "QyD", name: "Quy định", color: "#3F6212", icon: "list-checks" },
  { code: "BC", name: "Báo cáo", color: "#B45309", icon: "file-bar-chart" },
  { code: "TTr", name: "Tờ trình", color: "#A16207", icon: "file-signature" },
  { code: "BB", name: "Biên bản", color: "#475569", icon: "file-pen" },
  { code: "PL", name: "Phụ lục", color: "#64748B", icon: "paperclip" },
  { code: "KHAC", name: "Khác", color: "#6B7280", icon: "file-text" },
];

const FIELDS = [
  "Xây dựng Đảng",
  "Kinh tế",
  "Đô thị",
  "Giáo dục",
  "Y tế",
  "Văn hóa – Xã hội",
  "An ninh – Quốc phòng",
  "Chuyển đổi số",
  "Nội vụ",
  "Tài nguyên – Môi trường",
  "Khác",
];

const AGENCIES: [string, string][] = [
  ["Đảng ủy phường Thanh Liệt", "Phường"],
  ["HĐND phường Thanh Liệt", "Phường"],
  ["UBND phường Thanh Liệt", "Phường"],
  ["Ủy ban MTTQ phường Thanh Liệt", "Phường"],
  ["Thành ủy Hà Nội", "Thành phố"],
  ["HĐND thành phố Hà Nội", "Thành phố"],
  ["UBND thành phố Hà Nội", "Thành phố"],
  ["Sở Nội vụ", "Thành phố"],
  ["Sở Giáo dục và Đào tạo", "Thành phố"],
  ["Sở Y tế", "Thành phố"],
  ["Sở Văn hóa và Thể thao", "Thành phố"],
  ["Sở Xây dựng", "Thành phố"],
  ["Sở Tài chính", "Thành phố"],
  ["Sở Khoa học và Công nghệ", "Thành phố"],
  ["Công an thành phố Hà Nội", "Thành phố"],
];

export const OLD_AREAS = [
  "Thanh Liệt",
  "Tân Triều",
  "Đại Kim",
  "Hạ Đình",
  "Thanh Xuân Bắc",
  "Văn Quán",
  "Tả Thanh Oai",
];

export const PARTY_ROOT_NAME = "Đảng bộ phường Thanh Liệt";

async function seedCore() {
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
      partyOrgCountOverride: 63, // cho tới khi nhập đủ danh mục (Mục 15)
    },
  });

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await db.setting.upsert({ where: { key }, update: {}, create: { key, value } });
  }

  for (const [i, [name, shortName]] of DEPARTMENTS.entries()) {
    await db.department.upsert({
      where: { name },
      update: {},
      create: { name, shortName, sortOrder: i + 1 },
    });
  }
  for (const [i, t] of DOCUMENT_TYPES.entries()) {
    await db.documentType.upsert({
      where: { code: t.code },
      update: {},
      create: { ...t, isProgram: t.isProgram ?? false, sortOrder: i + 1 },
    });
  }
  for (const [i, name] of FIELDS.entries()) {
    await db.field.upsert({ where: { name }, update: {}, create: { name, sortOrder: i + 1 } });
  }
  for (const [name, level] of AGENCIES) {
    await db.issuingAgency.upsert({ where: { name }, update: {}, create: { name, level } });
  }
  for (const [i, name] of OLD_AREAS.entries()) {
    await db.oldArea.upsert({ where: { name }, update: {}, create: { name, sortOrder: i + 1 } });
  }

  if (!(await db.partyOrg.findFirst({ where: { type: "DANG_BO_PHUONG" } }))) {
    await db.partyOrg.create({
      data: { name: PARTY_ROOT_NAME, type: "DANG_BO_PHUONG", block: "KHAC" },
    });
  }

  // Tài khoản quản trị đầu tiên — chỉ tạo nếu chưa có, KHÔNG đặt lại mật khẩu khi seed lại
  if (!(await db.user.findUnique({ where: { username: "admin" } }))) {
    const dept = await db.department.findUnique({ where: { name: "Văn phòng HĐND và UBND" } });
    await db.user.create({
      data: {
        username: "admin",
        fullName: "Quản trị hệ thống",
        position: "Cán bộ CNTT",
        roles: ["ADMIN"],
        departmentId: dept?.id,
        passwordHash: await bcrypt.hash(
          process.env.SEED_ADMIN_PASSWORD ?? "ThanhLiet@2026",
          BCRYPT_COST,
        ),
        mustChangePassword: true,
      },
    });
  }
  console.log(
    "✔ Dữ liệu lõi: thông tin phường, cấu hình, đơn vị, danh mục, Đảng bộ phường, tài khoản admin.",
  );
}

async function main() {
  await seedCore();
  if (process.env.SEED_SAMPLE === "0") {
    console.log("• Bỏ qua dữ liệu mẫu (SEED_SAMPLE=0).");
    return;
  }
  await seedSample(db);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
