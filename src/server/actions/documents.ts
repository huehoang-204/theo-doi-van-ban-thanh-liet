"use server";

import { randomUUID } from "node:crypto";

import { Prisma } from "@/generated/prisma/client";
import { can } from "@/lib/permissions";
import {
  createDocumentSchema,
  deleteDocumentSchema,
  moveDocumentSchema,
  updateDocumentSchema,
} from "@/lib/schemas/document";
import {
  planMove,
  planReorder,
  placementUnder,
  validateCreate,
  validateMove,
  type LabeledPos,
} from "@/lib/tree";
import { withAuth } from "@/server/action";
import type { CurrentUser } from "@/server/auth/current-user";
import { recomputeTrees } from "@/server/documents/progress";
import { documentResourceOf, getMaxTreeDepth } from "@/server/documents/queries";
import { AppError } from "@/server/errors";
import { notify } from "@/server/notifications";
import { sanitizeSummary } from "@/server/sanitize";
import { z } from "zod";

type Tx = Prisma.TransactionClient;

// Thùng rác (quản trị) hiện cùng dữ liệu xoá mềm
const REVALIDATE: Array<string | [string, "layout"]> = [
  ["/van-ban", "layout"],
  "/quan-tri/thung-rac",
];
const idOnly = z.object({ id: z.string().min(1) });

const label = (n: { number: string | null; title: string }) =>
  n.number ?? (n.title.length > 60 ? `${n.title.slice(0, 59)}…` : n.title);

async function loadNode(tx: Tx, id: string) {
  const node = await tx.documentNode.findUnique({
    where: { id },
    include: { field: { select: { name: true } }, type: { select: { isProgram: true } } },
  });
  if (!node)
    throw new AppError(
      "NOT_FOUND",
      "Không tìm thấy văn bản — có thể đã bị xoá. Vui lòng tải lại trang.",
    );
  return node;
}

async function fieldName(tx: Tx, fieldId: string | null) {
  if (!fieldId) return null;
  return (
    (await tx.field.findUnique({ where: { id: fieldId }, select: { name: true } }))?.name ?? null
  );
}

async function canEdit(user: CurrentUser, tx: Tx, id: string) {
  return can(user, "document.update", documentResourceOf(await loadNode(tx, id)));
}

function dataOf(
  input: z.output<typeof createDocumentSchema> | z.output<typeof updateDocumentSchema>,
) {
  return {
    typeId: input.typeId,
    number: input.number,
    title: input.title,
    issuingAgencyId: input.issuingAgencyId,
    issuingAgencyText: input.issuingAgencyId ? null : input.issuingAgencyText,
    signer: input.signer,
    issuedDate: input.issuedDate,
    effectiveDate: input.effectiveDate,
    dueDate: input.dueDate,
    fieldId: input.fieldId,
    urgency: input.urgency,
    validity: input.validity,
    replacedById: input.validity === "REPLACED" ? input.replacedById : null,
    leadDepartmentId: input.leadDepartmentId,
    coDepartmentIds: input.coDepartmentIds,
    summary: sanitizeSummary(input.summary),
    tags: input.tags,
    isInternalPublic: input.isInternalPublic,
  };
}

// ---------------------------------------------------------------- Thêm

export const createDocument = withAuth(
  {
    // PARTY_ADMIN chỉ tạo văn bản lĩnh vực Xây dựng Đảng (Mục 12)
    permission: async (user, input, tx) =>
      can(user, "document.create", {
        createdById: user.id,
        leadDepartmentId: input.leadDepartmentId,
        coDepartmentIds: input.coDepartmentIds,
        isInternalPublic: input.isInternalPublic,
        fieldName: await fieldName(tx, input.fieldId),
      }),
    schema: createDocumentSchema,
    revalidate: REVALIDATE,
  },
  async ({ tx, user, input, audit }) => {
    const type = await tx.documentType.findUnique({ where: { id: input.typeId } });
    if (!type || !type.active)
      throw new AppError("INVALID_TYPE", "Loại văn bản không hợp lệ.", {
        typeId: "Loại văn bản không hợp lệ.",
      });

    let parent: LabeledPos | null = null;
    if (input.parentId) {
      // Khoá cha để hai người cùng thêm con không vượt giới hạn/thứ tự
      await tx.$queryRaw`SELECT "id" FROM "DocumentNode" WHERE "id" = ${input.parentId} FOR UPDATE`;
      const p = await tx.documentNode.findFirst({ where: { id: input.parentId, deletedAt: null } });
      if (!p) throw new AppError("PARENT_NOT_FOUND", "Văn bản cha không tồn tại hoặc đã bị xoá.");
      parent = { id: p.id, path: p.path, depth: p.depth, rootId: p.rootId, label: label(p) };
    }
    const error = validateCreate({
      parent,
      typeIsProgram: type.isProgram,
      maxDepth: await getMaxTreeDepth(),
    });
    if (error) throw new AppError("INVALID_TREE", error, parent ? undefined : { typeId: error });

    const id = randomUUID();
    const last = await tx.documentNode.aggregate({
      where: { parentId: parent?.id ?? null },
      _max: { sortOrder: true },
    });
    const created = await tx.documentNode.create({
      data: {
        id,
        ...placementUnder(parent, id),
        sortOrder: (last._max.sortOrder ?? 0) + 1,
        ...dataOf(input),
        createdById: user.id,
      },
    });
    audit({ action: "CREATE", entity: "DocumentNode", entityId: id, after: created });
    if (parent) await notifyProgramFollowers(tx, parent.rootId ?? parent.id, created, user.id);
    return { id, parentId: created.parentId };
  },
);

/**
 * Mục 5.4 "văn bản mới trong chương trình mình theo dõi": báo người theo dõi chương trình gốc
 * (trừ người vừa tạo), chỉ người được quyền xem văn bản mới.
 */
async function notifyProgramFollowers(
  tx: Prisma.TransactionClient,
  rootId: string,
  doc: {
    id: string;
    number: string | null;
    title: string;
    createdById: string;
    leadDepartmentId: string | null;
    coDepartmentIds: string[];
    isInternalPublic: boolean;
  },
  actorId: string,
) {
  const follows = await tx.documentFollow.findMany({
    where: { documentId: rootId, userId: { not: actorId }, user: { active: true } },
    select: { user: { select: { id: true, roles: true, departmentId: true } } },
  });
  if (follows.length === 0) return;
  const root = await tx.documentNode.findUnique({
    where: { id: rootId },
    select: { number: true, title: true },
  });
  const resource = documentResourceOf(doc);
  await notify(
    tx,
    follows
      .map((f) => f.user)
      .filter((u) => can(u, "document.view", resource))
      .map((u) => u.id),
    {
      kind: "NEW_DOCUMENT",
      title: `Văn bản mới trong “${root ? label(root) : "chương trình"}”: ${doc.number ? `${doc.number} ` : ""}${doc.title}`,
      link: `/van-ban/${doc.id}`,
    },
  );
}

/** Theo dõi / bỏ theo dõi một chương trình (văn bản cấp 1) để nhận thông báo văn bản mới */
export const setProgramFollow = withAuth(
  {
    permission: "document.list",
    schema: z.object({ id: z.string().min(1), follow: z.boolean() }),
    revalidate: [["/van-ban", "layout"]],
  },
  async ({ tx, user, input }) => {
    const node = await tx.documentNode.findFirst({
      where: { id: input.id, deletedAt: null },
      select: { parentId: true },
    });
    if (!node) throw new AppError("NOT_FOUND", "Văn bản không tồn tại hoặc đã bị xoá.");
    if (node.parentId)
      throw new AppError("NOT_PROGRAM", "Chỉ theo dõi được chương trình (văn bản cấp 1).");
    if (input.follow) {
      await tx.documentFollow.upsert({
        where: { documentId_userId: { documentId: input.id, userId: user.id } },
        update: {},
        create: { documentId: input.id, userId: user.id },
      });
    } else {
      await tx.documentFollow.deleteMany({ where: { documentId: input.id, userId: user.id } });
    }
    return { following: input.follow };
  },
);

// ---------------------------------------------------------------- Sửa

export const updateDocument = withAuth(
  {
    permission: async (user, input, tx) => {
      if (!(await canEdit(user, tx, input.id))) return false;
      // Đổi lĩnh vực cũng phải còn trong phạm vi được phép (PARTY_ADMIN)
      const node = await loadNode(tx, input.id);
      return can(user, "document.update", {
        ...documentResourceOf(node),
        fieldName: await fieldName(tx, input.fieldId),
      });
    },
    schema: updateDocumentSchema,
    revalidate: REVALIDATE,
  },
  async ({ tx, input, user, audit }) => {
    const before = await loadNode(tx, input.id);
    if (before.deletedAt)
      throw new AppError("DELETED", "Văn bản đang ở Thùng rác — hãy khôi phục trước khi sửa.");
    const type = await tx.documentType.findUnique({ where: { id: input.typeId } });
    if (!type)
      throw new AppError("INVALID_TYPE", "Loại văn bản không hợp lệ.", {
        typeId: "Loại văn bản không hợp lệ.",
      });
    if (before.depth === 1 && !type.isProgram) {
      const msg = "Văn bản cấp 1 phải thuộc loại “Chương trình”.";
      throw new AppError("INVALID_TYPE", msg, { typeId: msg });
    }
    if (input.replacedById === input.id) {
      const msg = "Văn bản không thể thay thế chính nó.";
      throw new AppError("INVALID_REPLACED", msg, { replacedById: msg });
    }
    const after = await tx.documentNode.update({
      where: { id: input.id },
      data: { ...dataOf(input), updatedById: user.id },
    });
    audit({ action: "UPDATE", entity: "DocumentNode", entityId: input.id, before, after });
    return { id: input.id, parentId: after.parentId };
  },
);

// ---------------------------------------------------------------- Di chuyển / sắp xếp (kéo-thả, "Chuyển đến…")

export const moveDocument = withAuth(
  {
    permission: (user, input, tx) => canEdit(user, tx, input.id),
    schema: moveDocumentSchema,
    revalidate: REVALIDATE,
  },
  async ({ tx, input, audit }) => {
    const node = await loadNode(tx, input.id);
    if (node.deletedAt)
      throw new AppError("DELETED", "Văn bản đang ở Thùng rác — hãy khôi phục trước.");

    // Khoá cả nhánh đang chuyển trong suốt transaction
    await tx.$queryRaw`SELECT "id" FROM "DocumentNode" WHERE "path" LIKE ${`${node.path}%`} FOR UPDATE`;

    let newParent: (LabeledPos & { deletedAt: Date | null }) | null = null;
    if (input.newParentId) {
      await tx.$queryRaw`SELECT "id" FROM "DocumentNode" WHERE "id" = ${input.newParentId} FOR UPDATE`;
      const p = await tx.documentNode.findUnique({ where: { id: input.newParentId } });
      if (!p || p.deletedAt)
        throw new AppError("PARENT_NOT_FOUND", "Văn bản đích không tồn tại hoặc đã bị xoá.");
      newParent = {
        id: p.id,
        path: p.path,
        depth: p.depth,
        rootId: p.rootId,
        label: label(p),
        deletedAt: p.deletedAt,
      };
    }

    // Gồm cả con cháu đã xoá mềm: chúng đi cùng nhánh để khôi phục sau vẫn đúng chỗ
    const descendants = await tx.documentNode.findMany({
      where: { path: { startsWith: node.path }, NOT: { id: node.id } },
      select: { id: true, path: true, depth: true, rootId: true },
    });
    const sameParent = (newParent?.id ?? null) === node.parentId;

    if (!sameParent) {
      const error = validateMove({
        node: {
          id: node.id,
          path: node.path,
          depth: node.depth,
          rootId: node.rootId,
          label: label(node),
        },
        nodeIsProgram: node.type.isProgram,
        maxDescendantDepth: descendants.length
          ? Math.max(...descendants.map((d) => d.depth))
          : null,
        newParent,
        maxDepth: await getMaxTreeDepth(),
      });
      if (error) throw new AppError("INVALID_MOVE", error);

      const plan = planMove(node, descendants, newParent);
      await tx.$executeRaw`
        UPDATE "DocumentNode" AS d
        SET "path" = u.path, "depth" = u.depth, "rootId" = u.root_id, "updatedAt" = now()
        FROM unnest(${plan.map((p) => p.id)}::text[], ${plan.map((p) => p.path)}::text[],
                    ${plan.map((p) => p.depth)}::int[], ${plan.map((p) => p.rootId)}::text[])
          AS u(id, path, depth, root_id)
        WHERE d."id" = u.id`;
      await tx.documentNode.update({
        where: { id: node.id },
        data: { parentId: newParent?.id ?? null },
      });
    }

    // Thứ tự mới trong cha đích
    const siblings = await tx.documentNode.findMany({
      where: { parentId: newParent?.id ?? null, deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
      select: { id: true },
    });
    const order = planReorder(
      siblings.map((s) => s.id),
      node.id,
      input.index,
    );
    await tx.$executeRaw`
      UPDATE "DocumentNode" AS d SET "sortOrder" = u.sort_order
      FROM unnest(${order.map((o) => o.id)}::text[], ${order.map((o) => o.sortOrder)}::int[]) AS u(id, sort_order)
      WHERE d."id" = u.id AND d."sortOrder" IS DISTINCT FROM u.sort_order`;

    // Tiến độ cộng dồn & chấm đỏ của cả cây cũ và cây mới (Mục 3.4)
    const after = await tx.documentNode.findUniqueOrThrow({
      where: { id: node.id },
      select: { rootId: true },
    });
    await recomputeTrees(tx, [node.rootId ?? node.id, after.rootId ?? node.id]);

    audit({
      action: "MOVE",
      entity: "DocumentNode",
      entityId: node.id,
      before: {
        parentId: node.parentId,
        path: node.path,
        depth: node.depth,
        sortOrder: node.sortOrder,
      },
      after: {
        parentId: newParent?.id ?? null,
        index: input.index,
        subtreeSize: descendants.length + 1,
      },
    });
    return { oldParentId: node.parentId, newParentId: newParent?.id ?? null };
  },
);

// ---------------------------------------------------------------- Xoá mềm / khôi phục

export const deleteDocument = withAuth(
  {
    permission: async (user, input, tx) =>
      can(user, "document.delete", documentResourceOf(await loadNode(tx, input.id))),
    schema: deleteDocumentSchema,
    revalidate: REVALIDATE,
  },
  async ({ tx, input, audit }) => {
    const node = await loadNode(tx, input.id);
    if (node.deletedAt) throw new AppError("DELETED", "Văn bản đã ở Thùng rác.");
    const descendantCount = await tx.documentNode.count({
      where: { path: { startsWith: node.path }, NOT: { id: node.id }, deletedAt: null },
    });
    if (descendantCount > 0 && !input.cascade) {
      throw new AppError(
        "HAS_CHILDREN",
        `Văn bản còn ${descendantCount} văn bản con/cháu. Hãy xác nhận “Xoá cả nhánh” nếu muốn xoá.`,
      );
    }
    // Cùng một mốc thời gian cho cả nhánh → khôi phục đúng những nút đã xoá cùng lúc
    const deletedAt = new Date();
    await tx.documentNode.updateMany({
      where: { path: { startsWith: node.path }, deletedAt: null },
      data: { deletedAt },
    });
    await recomputeTrees(tx, [node.rootId ?? node.id]);
    audit({
      action: "DELETE",
      entity: "DocumentNode",
      entityId: node.id,
      before: { title: node.title, number: node.number, path: node.path },
      after: { deletedAt, cascadeCount: descendantCount },
    });
    return { parentId: node.parentId, count: descendantCount + 1 };
  },
);

export const restoreDocument = withAuth(
  {
    permission: async (user, input, tx) =>
      can(user, "document.delete", documentResourceOf(await loadNode(tx, input.id))),
    schema: idOnly,
    revalidate: REVALIDATE,
  },
  async ({ tx, input, audit }) => {
    const node = await loadNode(tx, input.id);
    if (!node.deletedAt) throw new AppError("NOT_DELETED", "Văn bản không ở Thùng rác.");
    if (node.parentId) {
      const parent = await tx.documentNode.findUnique({
        where: { id: node.parentId },
        select: { deletedAt: true, title: true, number: true },
      });
      if (parent?.deletedAt) {
        throw new AppError(
          "PARENT_DELETED",
          `Văn bản cha “${label(parent)}” cũng đang ở Thùng rác — hãy khôi phục văn bản cha trước.`,
        );
      }
    }
    const restored = await tx.documentNode.updateMany({
      where: { path: { startsWith: node.path }, deletedAt: node.deletedAt },
      data: { deletedAt: null },
    });
    await recomputeTrees(tx, [node.rootId ?? node.id]);
    audit({
      action: "RESTORE",
      entity: "DocumentNode",
      entityId: node.id,
      after: { count: restored.count },
    });
    return { parentId: node.parentId, count: restored.count };
  },
);
