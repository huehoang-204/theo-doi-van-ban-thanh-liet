// Lịch chạy job dùng chung cho hai cách chạy:
//   - tiến trình riêng `npm run worker` (src/worker/index.ts) — máy chủ có Docker/VPS
//   - ngay trong tiến trình Next khi WORKER_INLINE=1 (src/instrumentation.ts) — Render: một service,
//     dùng chung Prisma client và ổ đĩa tệp, tiết kiệm ~200 MB RAM so với chạy hai tiến trình.
import cron from "node-cron";

import type { PrismaClient } from "@/generated/prisma/client";
import { VN_TIME_ZONE } from "@/lib/format";
import { jobsToCatchUp, JOBS, runJob, type JobName } from "@/server/jobs/runner";

export function workerLog(message: string, extra?: unknown) {
  const at = new Date().toLocaleString("vi-VN", { timeZone: VN_TIME_ZONE });
  console.log(`[worker ${at}] ${message}`, extra === undefined ? "" : JSON.stringify(extra));
}

export async function runAndLog(db: PrismaClient, name: JobName, now = new Date()) {
  workerLog(`Bắt đầu: ${JOBS[name].label}`);
  const record = await runJob(db, name, now);
  workerLog(record.ok ? `Xong (${record.ms} ms)` : `LỖI: ${record.error}`, record.result);
  return record.ok;
}

/** Đặt lịch các job theo giờ VN rồi chạy bù job hôm nay chưa chạy. Trả về hàm dừng lịch. */
export async function startScheduler(db: PrismaClient): Promise<() => Promise<void>> {
  const names = Object.keys(JOBS) as JobName[];
  const tasks = names.map((name) =>
    cron.schedule(JOBS[name].cron, () => runAndLog(db, name).then(() => undefined), {
      name,
      timezone: VN_TIME_ZONE,
      noOverlap: true,
    }),
  );
  workerLog(
    "Đã khởi động. Lịch: " + names.map((n) => `${JOBS[n].label} (${JOBS[n].cron})`).join("; "),
  );

  for (const name of await jobsToCatchUp(db)) {
    workerLog(`Chạy bù job hôm nay chưa chạy: ${name}`);
    await runAndLog(db, name);
  }
  return async () => {
    await Promise.all(tasks.map((t) => t.stop()));
  };
}
