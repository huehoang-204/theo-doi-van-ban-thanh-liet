"use server";

import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import { can } from "@/lib/permissions";
import { excerpt, publishTitle, resolveRecipients } from "@/lib/publish";
import { commentSchema, publishDocumentSchema } from "@/lib/schemas/publish";
import { withAuth } from "@/server/action";
import type { CurrentUser } from "@/server/auth/current-user";
import { documentResourceOf } from "@/server/documents/queries";
import { AppError } from "@/server/errors";

// Ban hành / gửi văn bản, thảo luận, theo dõi (GĐ5b).

type Tx = Prisma.TransactionClient;

async function loadDoc(tx: Tx, id: string) {
  const doc = await tx.documentNode.findUnique({
    where: { id },
    include: {
      field: { select: { name: true } },
      type: { select: { name: true } },
      shares: { select: { userId: true, direct: true } },
      tasks: {
        where: { deletedAt: null },
        select: {
          leadUserId: true,
          coUserIds: true,
          leadDepartmentId: true,
          coDepartmentIds: true,
        },
      },
    },
  });
  if (!doc || doc.deletedAt)
    throw new AppError(
      "NOT_FOUND",
      "Không tìm thấy văn bản — có thể đã bị xoá. Vui lòng tải lại trang.",
    );
  return doc;
}

const label = (d: { number: string | null; title: string }) =>
  d.number ?? (d.title.length > 60 ? `${d.title.slice(0, 59)}…` : d.title);

async function follow(tx: Tx, documentId: string, userId: string) {
  await tx.documentFollow.upsert({
    where: { documentId_userId: { documentId, userId } },
    update: {},
    create: { documentId, userId },
  });
}

const REVALIDATE: Array<string | [string, "layout"]> = [["/van-ban", "layout"], "/"];

/**
 * Ban hành / gửi văn bản tới người nhận. Gửi lần nữa = gửi bổ sung: chỉ người nhận mới được báo.
 * Người nhận được xem chi tiết & tải tệp (quyền qua DocumentShare). Người gửi tự theo dõi văn bản.
 */
export const publishDocument = withAuth(
  {
    permission: async (user, input, tx) =>
      can(user, "document.update", documentResourceOf(await loadDoc(tx, input.id))),
    schema: publishDocumentSchema,
    revalidate: REVALIDATE,
  },
  async ({ tx, user, input, audit }) => {
    const doc = await loadDoc(tx, input.id);
    const users = await tx.user.findMany({
      select: { id: true, departmentId: true, active: true },
    });
    const { userIds, direct } = resolveRecipients(input, users, user.id);
    if (userIds.length === 0)
      throw new AppError(
        "NO_RECIPIENTS",
        "Không có tài khoản nào đang hoạt động trong danh sách người nhận.",
        {
          recipients: "Đơn vị đã chọn chưa có tài khoản nào đang hoạt động.",
        },
      );

    const existing = new Map(doc.shares.map((s) => [s.userId, s.direct]));
    const added = userIds.filter((id) => !existing.has(id));
    if (added.length)
      await tx.documentShare.createMany({
        data: added.map((userId) => ({
          documentId: doc.id,
          userId,
          createdById: user.id,
          direct: direct.has(userId),
        })),
        skipDuplicates: true,
      });
    const nowDirect = [...direct].filter((id) => existing.has(id) && !existing.get(id));
    if (nowDirect.length)
      await tx.documentShare.updateMany({
        where: { documentId: doc.id, userId: { in: nowDirect } },
        data: { direct: true },
      });

    const now = new Date();
    await tx.documentNode.update({
      where: { id: doc.id },
      data: {
        publishedAt: doc.publishedAt ?? now,
        publishedById: doc.publishedById ?? user.id,
        publishMessage: input.message ?? doc.publishMessage,
        recipientAll: doc.recipientAll || input.all,
        recipientDepartmentIds: [
          ...new Set([...doc.recipientDepartmentIds, ...input.departmentIds]),
        ],
        updatedById: user.id,
      },
    });
    await follow(tx, doc.id, user.id);

    const sender = await tx.user.findUnique({
      where: { id: doc.publishedById ?? user.id },
      select: { fullName: true, department: { select: { name: true } } },
    });
    if (added.length)
      await tx.notification.createMany({
        data: added.map((userId) => ({
          userId,
          kind: "DOCUMENT_PUBLISHED",
          title: publishTitle({
            sender: sender?.department?.name ?? sender?.fullName ?? user.fullName,
            typeName: doc.type.name,
            title: doc.title,
            number: doc.number,
          }),
          link: `/van-ban/${doc.id}`,
          dedupKey: `PUBLISH:${doc.id}`,
        })),
        skipDuplicates: true,
      });

    audit({
      action: "PUBLISH",
      entity: "DocumentNode",
      entityId: doc.id,
      after: {
        title: doc.title,
        number: doc.number,
        recipientAll: input.all,
        departmentIds: input.departmentIds,
        recipients: existing.size + added.length,
        added: added.length,
        message: input.message,
      },
    });
    return {
      added: added.length,
      total: existing.size + added.length,
      firstTime: !doc.publishedAt,
    };
  },
);

// ---------------------------------------------------------------- Thảo luận

async function canView(user: CurrentUser, tx: Tx, documentId: string) {
  return can(user, "document.view", documentResourceOf(await loadDoc(tx, documentId)));
}

/** Viết thảo luận: người xem được văn bản; người viết tự theo dõi; báo người theo dõi, người tạo, người ban hành */
export const addComment = withAuth(
  {
    permission: (user, input, tx) => canView(user, tx, input.documentId),
    schema: commentSchema,
    revalidate: REVALIDATE,
  },
  async ({ tx, user, input, audit }) => {
    const doc = await loadDoc(tx, input.documentId);
    const comment = await tx.documentComment.create({
      data: { documentId: doc.id, userId: user.id, content: input.content },
    });
    await follow(tx, doc.id, user.id);

    const follows = await tx.documentFollow.findMany({
      where: { documentId: doc.id },
      select: { userId: true },
    });
    const candidates = [
      ...new Set([...follows.map((f) => f.userId), doc.createdById, doc.publishedById]),
    ].filter((id): id is string => !!id && id !== user.id);
    const people = await tx.user.findMany({
      where: { id: { in: candidates }, active: true },
      select: { id: true, roles: true, departmentId: true },
    });
    const resource = documentResourceOf(doc);
    const to = people.filter((p) => can(p, "document.view", resource)).map((p) => p.id);
    if (to.length)
      await tx.notification.createMany({
        data: to.map((userId) => ({
          userId,
          kind: "DOCUMENT_COMMENT",
          title: `${user.fullName} thảo luận trong “${label(doc)}”: ${excerpt(input.content)}`,
          link: `/van-ban/${doc.id}#thao-luan`,
        })),
      });

    audit({
      action: "CREATE",
      entity: "DocumentComment",
      entityId: comment.id,
      after: { documentId: doc.id, title: label(doc), content: excerpt(input.content, 200) },
    });
    return { id: comment.id };
  },
);

/** Xoá thảo luận của mình (ADMIN xoá được mọi thảo luận) — xoá mềm */
export const deleteComment = withAuth(
  {
    permission: async (user, input, tx) => {
      const c = await tx.documentComment.findUnique({ where: { id: input.id } });
      return !!c && (c.userId === user.id || user.roles.includes("ADMIN"));
    },
    schema: z.object({ id: z.string().min(1) }),
    revalidate: REVALIDATE,
  },
  async ({ tx, input, audit }) => {
    const c = await tx.documentComment.findUniqueOrThrow({ where: { id: input.id } });
    if (c.deletedAt) throw new AppError("DELETED", "Thảo luận đã được xoá.");
    await tx.documentComment.update({ where: { id: c.id }, data: { deletedAt: new Date() } });
    audit({
      action: "DELETE",
      entity: "DocumentComment",
      entityId: c.id,
      before: { documentId: c.documentId, content: excerpt(c.content, 200) },
    });
    return { documentId: c.documentId };
  },
);

// ---------------------------------------------------------------- Theo dõi

/** Theo dõi / bỏ theo dõi văn bản: nhận thông báo thảo luận mới và văn bản mới trong nhánh */
export const setDocumentFollow = withAuth(
  {
    permission: (user, input, tx) => canView(user, tx, input.id),
    schema: z.object({ id: z.string().min(1), follow: z.boolean() }),
    revalidate: REVALIDATE,
  },
  async ({ tx, user, input }) => {
    if (input.follow) await follow(tx, input.id, user.id);
    else await tx.documentFollow.deleteMany({ where: { documentId: input.id, userId: user.id } });
    return { following: input.follow };
  },
);
