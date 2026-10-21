import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { dateOnlyKey } from "@/lib/format";
import { can, canViewAllDocuments, type DocumentResource } from "@/lib/permissions";
import { escapeLike, searchTerms } from "@/lib/search";
import { DEFAULT_MAX_TREE_DEPTH, pathIds } from "@/lib/tree";
import type { CurrentUser } from "@/server/auth/current-user";
import { getSetting } from "@/server/queries/catalog";

// ---------------------------------------------------------------- Kiểu dữ liệu gửi xuống cây (JSON)

export type TreeNodeDTO = {
  id: string;
  parentId: string | null;
  path: string;
  depth: number;
  sortOrder: number;
  number: string | null;
  title: string;
  /** "YYYY-MM-DD" */
  issuedDate: string | null;
  validity: "ACTIVE" | "EXPIRED" | "REPLACED";
  /** % cộng dồn; null = nhánh chưa có việc */
  progress: number | null;
  hasOverdue: boolean;
  childCount: number;
  type: { code: string; name: string; color: string; icon: string; isProgram: boolean };
  /** Chỉ hiện để giữ cấu trúc cây — người dùng không có quyền xem chi tiết */
  restricted: boolean;
};

const NODE_SELECT = {
  id: true,
  parentId: true,
  path: true,
  depth: true,
  sortOrder: true,
  number: true,
  title: true,
  issuedDate: true,
  validity: true,
  progressCache: true,
  hasOverdueDescendant: true,
  type: { select: { code: true, name: true, color: true, icon: true, isProgram: true } },
} satisfies Prisma.DocumentNodeSelect;

type NodeRow = Prisma.DocumentNodeGetPayload<{ select: typeof NODE_SELECT }>;

function toDTO(row: NodeRow, childCount: number, restricted: boolean): TreeNodeDTO {
  return {
    id: row.id,
    parentId: row.parentId,
    path: row.path,
    depth: row.depth,
    sortOrder: row.sortOrder,
    number: row.number,
    title: row.title,
    issuedDate: row.issuedDate ? dateOnlyKey(row.issuedDate) : null,
    validity: row.validity,
    progress: row.progressCache,
    hasOverdue: row.hasOverdueDescendant,
    childCount,
    type: row.type,
    restricted,
  };
}

export async function getMaxTreeDepth(): Promise<number> {
  return getSetting("maxTreeDepth", DEFAULT_MAX_TREE_DEPTH);
}

// ---------------------------------------------------------------- Phạm vi xem (Mục 12)

/** Điều kiện Prisma: văn bản người dùng (OFFICER/VIEWER) được xem trực tiếp */
function directViewWhere(user: CurrentUser): Prisma.DocumentNodeWhereInput {
  const or: Prisma.DocumentNodeWhereInput[] = [];
  const dept = user.departmentId;
  if (user.roles.includes("OFFICER")) {
    or.push({ isInternalPublic: true });
    const taskOr: Prisma.TaskWhereInput[] = [
      { leadUserId: user.id },
      { coUserIds: { has: user.id } },
    ];
    if (dept) {
      or.push({ leadDepartmentId: dept }, { coDepartmentIds: { has: dept } });
      taskOr.push({ leadDepartmentId: dept }, { coDepartmentIds: { has: dept } });
    }
    or.push({ tasks: { some: { deletedAt: null, OR: taskOr } } });
  }
  // Người nhận văn bản ban hành (mọi vai trò)
  or.push({ shares: { some: { userId: user.id } } });
  return or.length > 0 ? { OR: or } : { id: { in: [] } };
}

export type DocumentScope = {
  /** Xem được chi tiết */
  direct: Set<string>;
  /** Hiện trên cây (gồm tổ tiên của các văn bản xem được) */
  visible: Set<string>;
  /** Số con hiện trên cây theo cha ("" = cấp 1) */
  childCounts: Map<string, number>;
};

/** null = xem được tất cả; ngược lại tập văn bản được xem/được hiện */
export async function documentScope(user: CurrentUser): Promise<DocumentScope | null> {
  if (canViewAllDocuments(user)) return null;
  const rows = await db.documentNode.findMany({
    where: { deletedAt: null, ...directViewWhere(user) },
    select: { id: true, path: true },
  });
  const direct = new Set(rows.map((r) => r.id));
  const visible = new Set<string>();
  const parentOf = new Map<string, string>();
  for (const r of rows) {
    const ids = pathIds(r.path);
    ids.forEach((id, i) => {
      visible.add(id);
      parentOf.set(id, i > 0 ? ids[i - 1]! : "");
    });
  }
  // Tổ tiên có thể đã bị xoá mềm → bỏ khỏi cây
  const deleted = await db.documentNode.findMany({
    where: { id: { in: [...visible] }, deletedAt: { not: null } },
    select: { id: true },
  });
  for (const d of deleted) visible.delete(d.id);
  const childCounts = new Map<string, number>();
  for (const id of visible) {
    const p = parentOf.get(id) ?? "";
    childCounts.set(p, (childCounts.get(p) ?? 0) + 1);
  }
  return { direct, visible, childCounts };
}

async function nodesWhere(
  where: Prisma.DocumentNodeWhereInput,
  scope: DocumentScope | null,
): Promise<TreeNodeDTO[]> {
  const rows = await db.documentNode.findMany({
    where: { deletedAt: null, ...where, ...(scope ? { id: { in: [...scope.visible] } } : {}) },
    select: { ...NODE_SELECT, _count: { select: { children: { where: { deletedAt: null } } } } },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
  });
  return rows.map(({ _count, ...row }) =>
    toDTO(
      row,
      scope ? (scope.childCounts.get(row.id) ?? 0) : _count.children,
      scope ? !scope.direct.has(row.id) : false,
    ),
  );
}

/** Con trực tiếp của một nút (null = các chương trình cấp 1) — tải lười theo nhánh */
export async function listChildren(
  user: CurrentUser,
  parentId: string | null,
): Promise<TreeNodeDTO[]> {
  return nodesWhere({ parentId }, await documentScope(user));
}

/** Mọi nút người dùng được thấy (nút "Mở tất cả") */
export async function listAllNodes(
  user: CurrentUser,
  limit = 3000,
): Promise<{ nodes: TreeNodeDTO[]; truncated: boolean }> {
  const scope = await documentScope(user);
  const nodes = await nodesWhere({}, scope);
  return { nodes: nodes.slice(0, limit), truncated: nodes.length > limit };
}

/**
 * Dữ liệu để mở sẵn đường tới các nút đích: các chương trình cấp 1 + con của mọi tổ tiên.
 * Trả kèm danh sách nút cần mở rộng.
 */
export async function revealNodes(
  user: CurrentUser,
  targetIds: string[],
): Promise<{ nodes: TreeNodeDTO[]; expand: string[] }> {
  const scope = await documentScope(user);
  const targets = await db.documentNode.findMany({
    where: { id: { in: targetIds.slice(0, 200) }, deletedAt: null },
    select: { path: true },
  });
  const expand = [...new Set(targets.flatMap((t) => pathIds(t.path).slice(0, -1)))].filter(
    (id) => !scope || scope.visible.has(id),
  );
  const nodes = await nodesWhere({ OR: [{ parentId: null }, { parentId: { in: expand } }] }, scope);
  return { nodes, expand };
}

// ---------------------------------------------------------------- Tìm kiếm không dấu (unaccent + pg_trgm)

export type SearchFilters = {
  q?: string;
  fieldId?: string;
  validity?: string;
  typeId?: string;
  limit?: number;
};

export type SearchHit = TreeNodeDTO & { trail: string };

/**
 * Mọi từ khoá đều phải xuất hiện (LIKE trên cột searchText đã bỏ dấu, có index GIN trigram);
 * xếp hạng theo word_similarity (pg_trgm) rồi ngày ban hành mới nhất.
 */
export async function searchDocuments(
  user: CurrentUser,
  filters: SearchFilters,
): Promise<{ hits: SearchHit[]; truncated: boolean }> {
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
  const terms = filters.q ? searchTerms(filters.q).map(escapeLike) : [];
  const scope = await documentScope(user);
  const conditions: Prisma.Sql[] = [Prisma.sql`"deletedAt" IS NULL`];
  if (terms.length > 0) {
    // Bỏ dấu từ khoá bằng unaccent (cùng hàm trigger dùng cho searchText) → "quyet dinh" khớp "Quyết định"
    conditions.push(
      Prisma.sql`"searchText" LIKE ALL (SELECT '%' || lower(unaccent(t)) || '%' FROM unnest(${terms}::text[]) AS t)`,
    );
  }
  if (filters.fieldId) conditions.push(Prisma.sql`"fieldId" = ${filters.fieldId}`);
  if (filters.typeId) conditions.push(Prisma.sql`"typeId" = ${filters.typeId}`);
  if (filters.validity) conditions.push(Prisma.sql`"validity"::text = ${filters.validity}`);
  if (scope) conditions.push(Prisma.sql`"id" = ANY(${[...scope.direct]}::text[])`);
  if (conditions.length === 1) return { hits: [], truncated: false };

  const query = (filters.q ?? "").trim();
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "DocumentNode"
    WHERE ${Prisma.join(conditions, " AND ")}
    ORDER BY word_similarity(lower(unaccent(${query})), "searchText") DESC, "issuedDate" DESC NULLS LAST, "depth" ASC
    LIMIT ${limit + 1}`;
  const ids = rows.slice(0, limit).map((r) => r.id);
  if (ids.length === 0) return { hits: [], truncated: false };

  const nodes = await nodesWhere({ id: { in: ids } }, scope);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const ancestorIdsAll = [...new Set(nodes.flatMap((n) => pathIds(n.path).slice(0, -1)))];
  const ancestors = await db.documentNode.findMany({
    where: { id: { in: ancestorIdsAll } },
    select: { id: true, number: true, title: true },
  });
  const label = new Map(ancestors.map((a) => [a.id, a.number ?? shorten(a.title, 40)]));
  const hits = ids
    .map((id) => byId.get(id))
    .filter((n): n is TreeNodeDTO => !!n)
    .map((n) => ({
      ...n,
      trail: pathIds(n.path)
        .slice(0, -1)
        .map((id) => label.get(id) ?? "…")
        .join(" › "),
    }));
  return { hits, truncated: rows.length > limit };
}

function shorten(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

// ---------------------------------------------------------------- Chi tiết văn bản

const DETAIL_INCLUDE = {
  type: true,
  field: true,
  issuingAgency: true,
  leadDepartment: { select: { id: true, name: true } },
  replacedBy: { select: { id: true, number: true, title: true } },
  replaces: { where: { deletedAt: null }, select: { id: true, number: true, title: true } },
  createdBy: { select: { fullName: true } },
  updatedBy: { select: { fullName: true } },
  attachments: {
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
    include: { uploadedBy: { select: { fullName: true } } },
  },
  tasks: {
    where: { deletedAt: null },
    orderBy: [{ dueDate: "asc" }],
    include: {
      leadUser: { select: { fullName: true } },
      leadDepartment: { select: { name: true } },
    },
  },
  reportRequirements: {
    orderBy: { createdAt: "asc" },
    include: { recipientAgency: { select: { name: true } } },
  },
  shares: { select: { userId: true } },
  _count: { select: { children: { where: { deletedAt: null } } } },
} satisfies Prisma.DocumentNodeInclude;

export type DocumentDetail = Prisma.DocumentNodeGetPayload<{ include: typeof DETAIL_INCLUDE }>;

export function documentResourceOf(doc: {
  createdById: string;
  leadDepartmentId: string | null;
  coDepartmentIds: string[];
  isInternalPublic: boolean;
  field?: { name: string } | null;
  shares?: { userId: string }[];
  tasks?: {
    leadUserId: string | null;
    coUserIds: string[];
    leadDepartmentId: string | null;
    coDepartmentIds: string[];
  }[];
}): DocumentResource {
  return {
    createdById: doc.createdById,
    leadDepartmentId: doc.leadDepartmentId,
    coDepartmentIds: doc.coDepartmentIds,
    isInternalPublic: doc.isInternalPublic,
    fieldName: doc.field?.name ?? null,
    sharedUserIds: doc.shares?.map((s) => s.userId),
    taskUserIds: doc.tasks?.flatMap((t) =>
      [t.leadUserId, ...t.coUserIds].filter((x): x is string => !!x),
    ),
    taskDepartmentIds: doc.tasks?.flatMap((t) =>
      [t.leadDepartmentId, ...t.coDepartmentIds].filter((x): x is string => !!x),
    ),
  };
}

export type DocumentDetailResult =
  | { status: "not-found" }
  | {
      status: "forbidden";
      node: { id: string; path: string; title: string; number: string | null };
    }
  | {
      status: "ok";
      doc: DocumentDetail;
      ancestors: { id: string; number: string | null; title: string }[];
      resource: DocumentResource;
    };

export async function getDocumentDetail(
  user: CurrentUser,
  id: string,
): Promise<DocumentDetailResult> {
  const doc = await db.documentNode.findUnique({ where: { id }, include: DETAIL_INCLUDE });
  if (!doc || doc.deletedAt) return { status: "not-found" };
  const resource = documentResourceOf(doc);
  if (!can(user, "document.view", resource)) {
    return {
      status: "forbidden",
      node: { id: doc.id, path: doc.path, title: doc.title, number: doc.number },
    };
  }
  const ancestorIdList = pathIds(doc.path).slice(0, -1);
  const ancestors = await db.documentNode.findMany({
    where: { id: { in: ancestorIdList } },
    select: { id: true, number: true, title: true },
  });
  const order = new Map(ancestorIdList.map((a, i) => [a, i]));
  ancestors.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  return { status: "ok", doc, ancestors, resource };
}

/** Lịch sử thao tác trên văn bản và tệp đính kèm của nó */
export async function documentHistory(id: string) {
  return db.auditLog.findMany({
    where: {
      OR: [
        { entity: "DocumentNode", entityId: id },
        { entity: "Attachment", after: { path: ["documentId"], equals: id } },
        { entity: "Attachment", before: { path: ["documentId"], equals: id } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: { select: { fullName: true } } },
  });
}

// ---------------------------------------------------------------- Dạng danh sách & xuất Excel

export async function listDocumentsFlat(
  user: CurrentUser,
  options: { rootId?: string | null; deleted?: boolean } = {},
) {
  const scope = await documentScope(user);
  const rows = await db.documentNode.findMany({
    where: {
      deletedAt: options.deleted ? { not: null } : null,
      ...(options.rootId ? { OR: [{ id: options.rootId }, { rootId: options.rootId }] } : {}),
      ...(scope ? { id: { in: [...scope.direct] } } : {}),
    },
    include: {
      type: { select: { code: true, name: true, color: true, isProgram: true } },
      field: { select: { id: true, name: true } },
      issuingAgency: { select: { name: true } },
      leadDepartment: { select: { name: true } },
      _count: { select: { attachments: { where: { deletedAt: null } } } },
    },
    orderBy: [{ path: "asc" }],
    take: 10_000,
  });
  return rows;
}
