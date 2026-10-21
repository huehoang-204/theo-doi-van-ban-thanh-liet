import "server-only";

// Tìm kiếm toàn cục Ctrl+K (Mục 8.2.13): văn bản, công việc, trường, TDP, tổ chức đảng — không dấu, theo từng từ.
// Mỗi nhóm lọc theo phạm vi xem của người dùng (văn bản: documentScope; công việc: taskScopeWhere).
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { formatDate, formatNumber } from "@/lib/format";
import { PARTY_ORG_TYPE_LABELS, SCHOOL_LEVEL_LABELS } from "@/lib/i18n/enums";
import { can } from "@/lib/permissions";
import { escapeLike, isSearchable, searchTerms } from "@/lib/search";
import { statusLabel, taskDueStatus } from "@/lib/status";
import type { CurrentUser } from "@/server/auth/current-user";
import { searchDocuments } from "@/server/documents/queries";
import { taskScopeWhere } from "@/server/tasks/queries";

export type SearchGroupKey = "documents" | "tasks" | "schools" | "residentials" | "partyOrgs";

export type GlobalSearchItem = { id: string; title: string; subtitle: string; href: string };
export type GlobalSearchGroup = { key: SearchGroupKey; label: string; items: GlobalSearchItem[] };
export type GlobalSearchResult = { q: string; terms: string[]; groups: GlobalSearchGroup[] };

const PER_GROUP = 6;

/** Điều kiện "mọi từ đều có" trên biểu thức đã bỏ dấu */
function likeAll(expr: Prisma.Sql, terms: string[]): Prisma.Sql {
  return Prisma.sql`lower(unaccent(${expr})) LIKE ALL (SELECT '%' || lower(unaccent(t)) || '%' FROM unnest(${terms}::text[]) AS t)`;
}

async function matchIds(
  table: "Task" | "School" | "Residential" | "PartyOrg",
  expr: Prisma.Sql,
  extra: Prisma.Sql,
  terms: string[],
  q: string,
  limit: number,
): Promise<string[]> {
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM ${Prisma.raw(`"${table}"`)}
    WHERE ${extra} AND ${likeAll(expr, terms)}
    ORDER BY word_similarity(lower(unaccent(${q})), lower(unaccent(${expr}))) DESC
    LIMIT ${limit}`;
  return rows.map((r) => r.id);
}

const byOrder = <T extends { id: string }>(ids: string[], rows: T[]) => {
  const m = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => m.get(id)).filter((r): r is T => !!r);
};

const tim = (name: string) => `tim=${encodeURIComponent(name)}`;

export async function globalSearch(
  user: CurrentUser,
  rawQuery: string,
): Promise<GlobalSearchResult> {
  const q = rawQuery.trim().slice(0, 100);
  if (!isSearchable(q)) return { q, terms: [], groups: [] };
  const terms = searchTerms(q).map(escapeLike);
  const now = new Date();

  const [documents, tasks, schools, residentials, partyOrgs] = await Promise.all([
    // ---- Văn bản
    can(user, "document.list")
      ? searchDocuments(user, { q, limit: PER_GROUP }).then(({ hits }) =>
          hits.map((h): GlobalSearchItem => ({
            id: h.id,
            title: h.number ? `${h.number} — ${h.title}` : h.title,
            subtitle: [
              h.type.name,
              h.issuedDate ? formatDate(new Date(`${h.issuedDate}T00:00:00Z`)) : null,
              h.trail,
            ]
              .filter(Boolean)
              .join(" · "),
            href: `/van-ban/${h.id}`,
          })),
        )
      : [],
    // ---- Công việc (trong phạm vi xem)
    (async () => {
      if (!can(user, "task.list")) return [];
      const ids = await matchIds(
        "Task",
        Prisma.sql`"title" || ' ' || coalesce("description", '')`,
        Prisma.sql`"deletedAt" IS NULL`,
        terms,
        q,
        60,
      );
      if (ids.length === 0) return [];
      const scope = taskScopeWhere(user);
      const rows = await db.task.findMany({
        where: { id: { in: ids }, ...(scope ? { AND: [scope] } : {}) },
        select: {
          id: true,
          title: true,
          dueDate: true,
          flow: true,
          completedAt: true,
          submittedAt: true,
          leadDepartment: { select: { name: true } },
          leadUser: { select: { fullName: true } },
        },
      });
      return byOrder(ids, rows)
        .slice(0, PER_GROUP)
        .map((t): GlobalSearchItem => {
          const status = taskDueStatus(t, now);
          return {
            id: t.id,
            title: t.title,
            subtitle: [
              status ? statusLabel(status) : "Đã huỷ",
              t.dueDate ? `hạn ${formatDate(t.dueDate)}` : null,
              t.leadUser?.fullName ?? t.leadDepartment?.name,
            ]
              .filter(Boolean)
              .join(" · "),
            href: `/cong-viec/${t.id}`,
          };
        });
    })(),
    // ---- Trường học
    (async () => {
      if (!can(user, "school.view")) return [];
      const ids = await matchIds(
        "School",
        Prisma.sql`"name" || ' ' || coalesce("address", '')`,
        Prisma.sql`"active"`,
        terms,
        q,
        PER_GROUP,
      );
      const rows = await db.school.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, level: true, address: true },
      });
      return byOrder(ids, rows).map((s): GlobalSearchItem => ({
        id: s.id,
        title: s.name,
        subtitle: [SCHOOL_LEVEL_LABELS[s.level], s.address].filter(Boolean).join(" · "),
        href: `/dia-ban/truong-hoc?${tim(s.name)}`,
      }));
    })(),
    // ---- Tổ dân phố (tìm cả theo tên khu vực cũ)
    (async () => {
      if (!can(user, "residential.view")) return [];
      const ids = await matchIds(
        "Residential",
        Prisma.sql`"name" || ' ' || coalesce((SELECT o."name" FROM "OldArea" o WHERE o."id" = "oldAreaId"), '')`,
        Prisma.sql`"active"`,
        terms,
        q,
        PER_GROUP,
      );
      const rows = await db.residential.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          name: true,
          population: true,
          households: true,
          oldArea: { select: { name: true } },
        },
      });
      return byOrder(ids, rows).map((r): GlobalSearchItem => ({
        id: r.id,
        title: r.name,
        subtitle: [
          r.oldArea ? `Khu vực cũ: ${r.oldArea.name}` : null,
          r.households !== null ? `${formatNumber(r.households)} hộ` : null,
          r.population !== null ? `${formatNumber(r.population)} nhân khẩu` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        href: `/dia-ban/to-dan-pho?${tim(r.name)}`,
      }));
    })(),
    // ---- Tổ chức đảng, chi bộ
    (async () => {
      if (!can(user, "partyOrg.view")) return [];
      const ids = await matchIds(
        "PartyOrg",
        Prisma.sql`"name"`,
        Prisma.sql`"active"`,
        terms,
        q,
        PER_GROUP,
      );
      const rows = await db.partyOrg.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, type: true, memberCount: true },
      });
      return byOrder(ids, rows).map((o): GlobalSearchItem => ({
        id: o.id,
        title: o.name,
        subtitle: [
          PARTY_ORG_TYPE_LABELS[o.type],
          o.memberCount ? `${formatNumber(o.memberCount)} đảng viên` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        href: `/dia-ban/to-chuc-dang?${tim(o.name)}`,
      }));
    })(),
  ]);

  const groups: GlobalSearchGroup[] = [
    { key: "documents", label: "Văn bản", items: documents },
    { key: "tasks", label: "Công việc", items: tasks },
    { key: "schools", label: "Trường học", items: schools },
    { key: "residentials", label: "Tổ dân phố", items: residentials },
    { key: "partyOrgs", label: "Tổ chức đảng, chi bộ", items: partyOrgs },
  ];
  return { q, terms: searchTerms(q), groups: groups.filter((g) => g.items.length > 0) };
}
