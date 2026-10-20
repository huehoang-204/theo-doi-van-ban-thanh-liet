import "server-only";

import type { Prisma } from "@/generated/prisma/client";

/** Bản ghi nhật ký (Mục 13.2: mọi thao tác ghi, đăng nhập, tải tệp, xuất dữ liệu) */
export type AuditEntry = {
  action:
    | "CREATE"
    | "UPDATE"
    | "DELETE"
    | "MOVE"
    | "RESTORE"
    | "LOGIN"
    | "LOGIN_FAILED"
    | "LOGOUT"
    | "CHANGE_PASSWORD"
    | "RESET_PASSWORD"
    | "UNLOCK"
    | "IMPORT"
    | "EXPORT"
    | "DOWNLOAD";
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
};

type AuditWriter = Pick<Prisma.TransactionClient, "auditLog">;

/** Bỏ trường nhạy cảm trước khi lưu vào nhật ký */
function scrub(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(
    JSON.stringify(value, (key, v) => (key === "passwordHash" ? undefined : v)),
  ) as Prisma.InputJsonValue;
}

export async function audit(
  db: AuditWriter,
  userId: string | null,
  ip: string | null,
  entries: AuditEntry | AuditEntry[],
): Promise<void> {
  const list = Array.isArray(entries) ? entries : [entries];
  if (list.length === 0) return;
  await db.auditLog.createMany({
    data: list.map((e) => ({
      userId,
      ip,
      action: e.action,
      entity: e.entity,
      entityId: e.entityId ?? null,
      before: scrub(e.before),
      after: scrub(e.after),
    })),
  });
}
