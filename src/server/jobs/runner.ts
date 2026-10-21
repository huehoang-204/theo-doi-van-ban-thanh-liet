// Chạy một job có ghi lại lần chạy gần nhất vào Setting (`job.<name>`) — để chạy bù khi worker khởi động
// và để trang quản trị biết job đã chạy chưa.
import type { PrismaClient } from "@/generated/prisma/client";
import { vnDateKey } from "@/lib/format";
import { DAILY_JOB_AT, shouldCatchUp } from "@/lib/reminders";
import { runDailyJob } from "@/server/jobs/daily";
import { runNightlyJob } from "@/server/jobs/nightly";

export type JobName = "daily" | "nightly";

export const JOBS: Record<
  JobName,
  {
    label: string;
    cron: string;
    at: { hour: number; minute: number } | null;
    run: (db: PrismaClient, now: Date) => Promise<unknown>;
  }
> = {
  daily: {
    label: "Nhắc hạn 06:30",
    cron: `${DAILY_JOB_AT.minute} ${DAILY_JOB_AT.hour} * * *`,
    at: DAILY_JOB_AT,
    run: runDailyJob,
  },
  nightly: {
    label: "Tính lại tiến độ & dọn Thùng rác",
    cron: "15 0 * * *",
    at: null,
    run: runNightlyJob,
  },
};

export type JobRecord = {
  day: string;
  at: string;
  ms: number;
  ok: boolean;
  result?: unknown;
  error?: string;
};

const settingKey = (name: JobName) => `job.${name}`;

export async function lastRun(db: PrismaClient, name: JobName): Promise<JobRecord | null> {
  const row = await db.setting.findUnique({ where: { key: settingKey(name) } });
  return (row?.value as JobRecord | undefined) ?? null;
}

export async function runJob(
  db: PrismaClient,
  name: JobName,
  now = new Date(),
): Promise<JobRecord> {
  const started = Date.now();
  let record: JobRecord;
  try {
    const result = await JOBS[name].run(db, now);
    record = {
      day: vnDateKey(now),
      at: now.toISOString(),
      ms: Date.now() - started,
      ok: true,
      result,
    };
  } catch (e) {
    record = {
      day: (await lastRun(db, name))?.day ?? "", // lỗi → không tính là đã chạy hôm nay (chạy bù lần sau)
      at: now.toISOString(),
      ms: Date.now() - started,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
    console.error(`[worker] Job ${name} lỗi:`, e);
  }
  const value = JSON.parse(JSON.stringify(record));
  await db.setting.upsert({
    where: { key: settingKey(name) },
    update: { value },
    create: { key: settingKey(name), value },
  });
  return record;
}

/** Các job cần chạy bù ngay lúc worker khởi động */
export async function jobsToCatchUp(db: PrismaClient, now = new Date()): Promise<JobName[]> {
  // Job đêm trước (tiến độ, chấm đỏ, Thùng rác) rồi mới nhắc hạn
  const names: JobName[] = ["nightly", "daily"];
  const out: JobName[] = [];
  for (const name of names) {
    const last = await lastRun(db, name);
    // Lần lỗi giữ nguyên `day` của lần chạy thành công trước → vẫn được chạy bù
    if (shouldCatchUp(last?.day || null, now, JOBS[name].at)) out.push(name);
  }
  return out;
}
