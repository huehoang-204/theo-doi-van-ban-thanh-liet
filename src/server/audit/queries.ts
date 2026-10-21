import "server-only";

// Trang Nhật ký (Mục 13.2, 14 GĐ5): lọc theo người / đối tượng / hành động / khoảng ngày, phân trang phía server.
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export const AUDIT_PAGE_SIZE = 50;
export const AUDIT_EXPORT_MAX = 10_000;
/** Giá trị lọc "người thực hiện" cho thao tác của hệ thống (worker) */
export const SYSTEM_ACTOR = "he-thong";

export type AuditFilters = {
  userId?: string;
  entity?: string;
  entityId?: string;
  action?: string;
  /** "dd/mm/yyyy" theo ngày VN */
  from?: string;
  to?: string;
  page: number;
};

const str = (v: string | string[] | null | undefined) =>
  typeof v === "string" && v.trim() ? v.trim() : undefined;

/** Tham số URL tiếng Việt → bộ lọc: ?nguoi=&doiTuong=&ma=&hanhDong=&tu=&den=&trang= */
export function parseAuditFilters(
  get: (key: string) => string | string[] | null | undefined,
): AuditFilters {
  return {
    userId: str(get("nguoi")),
    entity: str(get("doiTuong")),
    entityId: str(get("ma")),
    action: str(get("hanhDong")),
    from: str(get("tu")),
    to: str(get("den")),
    page: Math.max(1, Number(get("trang")) || 1),
  };
}

/** "21/10/2026" → mốc 00:00 giờ VN; ngày không hợp lệ → null */
export function vnDayStart(text: string | undefined, plusDays = 0): Date | null {
  const m = text?.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const date = new Date(`${y}-${mo!.padStart(2, "0")}-${d!.padStart(2, "0")}T00:00:00+07:00`);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getTime() + plusDays * 86_400_000);
}

function whereOf(f: AuditFilters): Prisma.AuditLogWhereInput {
  const from = vnDayStart(f.from);
  const toExclusive = vnDayStart(f.to, 1);
  return {
    ...(f.userId === SYSTEM_ACTOR ? { userId: null } : f.userId ? { userId: f.userId } : {}),
    ...(f.entity ? { entity: f.entity } : {}),
    ...(f.entityId ? { entityId: f.entityId } : {}),
    ...(f.action ? { action: f.action } : {}),
    ...(from || toExclusive
      ? {
          createdAt: {
            ...(from ? { gte: from } : {}),
            ...(toExclusive ? { lt: toExclusive } : {}),
          },
        }
      : {}),
  };
}

export type AuditRow = {
  id: string;
  createdAt: Date;
  action: string;
  entity: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  user: { fullName: string; username: string } | null;
};

const SELECT = {
  id: true,
  createdAt: true,
  action: true,
  entity: true,
  entityId: true,
  before: true,
  after: true,
  ip: true,
  user: { select: { fullName: true, username: true } },
} as const;

export async function listAuditLogs(
  f: AuditFilters,
  pageSize = AUDIT_PAGE_SIZE,
): Promise<{ rows: AuditRow[]; total: number; pageCount: number }> {
  const where = whereOf(f);
  const [rows, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: pageSize,
      skip: (f.page - 1) * pageSize,
      select: SELECT,
    }),
    db.auditLog.count({ where }),
  ]);
  return { rows, total, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function auditLogsForExport(f: AuditFilters): Promise<AuditRow[]> {
  return db.auditLog.findMany({
    where: whereOf(f),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: AUDIT_EXPORT_MAX,
    select: SELECT,
  });
}

/** Giá trị cho các ô lọc: mọi người dùng (kể cả đã khoá), các loại đối tượng / hành động đã có trong nhật ký */
export async function auditFilterOptions() {
  const [users, entities, actions] = await Promise.all([
    db.user.findMany({
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, username: true },
    }),
    db.auditLog.findMany({ distinct: ["entity"], select: { entity: true } }),
    db.auditLog.findMany({ distinct: ["action"], select: { action: true } }),
  ]);
  return {
    users,
    entities: entities.map((e) => e.entity),
    actions: actions.map((a) => a.action),
  };
}
