// Tiến trình worker riêng (Mục 5.4, 9.1): `npm run worker`
//   - 06:30 hằng ngày (giờ VN): bổ sung kỳ báo cáo, sinh thông báo nhắc hạn
//   - 00:15 hằng đêm: tính lại tiến độ cộng dồn toàn bộ cây, dọn Thùng rác quá 30 ngày
// Khởi động sau giờ chạy mà hôm nay chưa chạy → chạy bù ngay.
// (Trên Render, lịch này chạy trong tiến trình web — WORKER_INLINE=1, xem src/instrumentation.ts.)
//
// Chạy một lần rồi thoát (vận hành / kiểm thử):
//   npm run worker -- --once daily|nightly|all [--now 2026-10-21T06:30:00+07:00]
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";
import { JOBS, type JobName } from "@/server/jobs/runner";

import { runAndLog, startScheduler, workerLog } from "./scheduler";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function once(which: string) {
  const now = arg("--now") ? new Date(arg("--now")!) : new Date();
  if (Number.isNaN(now.getTime())) throw new Error(`--now không hợp lệ: ${arg("--now")}`);
  const names: JobName[] =
    which === "all" ? ["nightly", "daily"] : which in JOBS ? [which as JobName] : [];
  if (names.length === 0) throw new Error(`Job không tồn tại: ${which} (daily | nightly | all)`);
  let ok = true;
  for (const n of names) ok = (await runAndLog(db, n, now)) && ok;
  await db.$disconnect();
  process.exit(ok ? 0 : 1);
}

async function main() {
  const which = arg("--once");
  if (which) return once(which);

  const stopScheduler = await startScheduler(db);
  const stop = async (signal: string) => {
    workerLog(`Nhận ${signal}, dừng worker`);
    await stopScheduler();
    await db.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", () => void stop("SIGINT"));
  process.on("SIGTERM", () => void stop("SIGTERM"));
}

main().catch(async (e) => {
  console.error("[worker] Lỗi nghiêm trọng:", e);
  await db.$disconnect();
  process.exit(1);
});
