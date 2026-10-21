// Ghi kỳ báo cáo vào CSDL từ quy tắc (dùng chung cho server action, seed, job hằng ngày).
// Không đánh dấu "server-only" vì seed/worker cũng dùng.
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { vnDateKey } from "@/lib/format";
import {
  generatePeriods,
  MAX_PERIODS_PER_DEPARTMENT,
  type RequirementRule,
} from "@/lib/report-periods";

type Db = Prisma.TransactionClient | PrismaClient;

type RequirementForPeriods = RequirementRule & { id: string; departmentIds: string[] };

/** Sinh kỳ còn thiếu (bỏ qua kỳ đã có — khoá duy nhất requirementId+periodStart+departmentId) */
export async function createMissingPeriods(
  db: Db,
  req: RequirementForPeriods,
  options: { after?: Date | null; limit?: number } = {},
): Promise<number> {
  const specs = generatePeriods(req, options);
  if (specs.length === 0 || req.departmentIds.length === 0) return 0;
  const result = await db.reportPeriod.createMany({
    data: req.departmentIds.flatMap((departmentId) =>
      specs.map((s) => ({ ...s, requirementId: req.id, departmentId })),
    ),
    skipDuplicates: true,
  });
  return result.count;
}

/**
 * Sửa yêu cầu (Mục 11 updateRequirement): xoá kỳ TƯƠNG LAI chưa nộp (hạn từ hôm nay) rồi sinh lại theo quy tắc mới.
 * Kỳ đã nộp hoặc đã quá hạn giữ nguyên để không mất lịch sử.
 */
export async function regenerateFuturePeriods(
  db: Db,
  req: RequirementForPeriods,
  now = new Date(),
): Promise<{ removed: number; created: number }> {
  const today = new Date(`${vnDateKey(now)}T00:00:00Z`);
  const removed = await db.reportPeriod.deleteMany({
    where: { requirementId: req.id, submission: null, dueDate: { gte: today } },
  });
  // Đơn vị bị bỏ khỏi yêu cầu: bỏ cả kỳ quá hạn chưa nộp của họ
  const dropped = await db.reportPeriod.deleteMany({
    where: { requirementId: req.id, submission: null, departmentId: { notIn: req.departmentIds } },
  });
  let created = 0;
  for (const departmentId of req.departmentIds) {
    // Sinh lại phần tương lai: kỳ đã giữ lại (đã nộp/quá hạn) bị bỏ qua nhờ khoá duy nhất,
    // nên nới giới hạn thêm đúng số kỳ đó để vẫn đủ 24 kỳ mới cho mỗi đơn vị
    const kept = await db.reportPeriod.count({ where: { requirementId: req.id, departmentId } });
    created += await createMissingPeriods(
      db,
      { ...req, departmentIds: [departmentId] },
      { limit: MAX_PERIODS_PER_DEPARTMENT + kept },
    );
  }
  return { removed: removed.count + dropped.count, created };
}

/**
 * Job hằng ngày (Mục 5.1): yêu cầu không có ngày kết thúc (hoặc dài) → khi còn ít hơn 6 kỳ tương lai
 * cho một đơn vị thì sinh tiếp tới đủ 24 kỳ tương lai.
 */
export async function extendOpenRequirements(db: Db, now = new Date()): Promise<number> {
  const today = new Date(`${vnDateKey(now)}T00:00:00Z`);
  const reqs = await db.reportRequirement.findMany({
    where: { active: true, frequency: { not: "ONCE" } },
  });
  let created = 0;
  for (const req of reqs) {
    for (const departmentId of req.departmentIds) {
      const future = await db.reportPeriod.count({
        where: { requirementId: req.id, departmentId, dueDate: { gte: today } },
      });
      if (future >= 6) continue;
      const last = await db.reportPeriod.findFirst({
        where: { requirementId: req.id, departmentId },
        orderBy: { periodStart: "desc" },
      });
      created += await createMissingPeriods(
        db,
        { ...req, departmentIds: [departmentId] },
        {
          after: last?.periodStart ?? null,
          limit: MAX_PERIODS_PER_DEPARTMENT - future,
        },
      );
    }
  }
  return created;
}
