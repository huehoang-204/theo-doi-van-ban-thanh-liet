import "server-only";

// Ban hành – người nhận – đã xem – đã tải – theo dõi – thảo luận của một văn bản (GĐ5b).
import { db } from "@/lib/db";
import { groupByDay } from "@/lib/publish";
import type { CurrentUser } from "@/server/auth/current-user";
import { documentScope } from "@/server/documents/queries";

/** Ghi "đã xem" khi mở chi tiết; thông báo trỏ tới văn bản này coi như đã đọc */
export async function recordDocumentView(user: CurrentUser, documentId: string): Promise<void> {
  const now = new Date();
  await db.$transaction([
    db.documentView.upsert({
      where: { documentId_userId: { documentId, userId: user.id } },
      update: { lastViewedAt: now, viewCount: { increment: 1 } },
      create: { documentId, userId: user.id, firstViewedAt: now, lastViewedAt: now },
    }),
    db.notification.updateMany({
      where: { userId: user.id, readAt: null, link: { startsWith: `/van-ban/${documentId}` } },
      data: { readAt: now },
    }),
  ]);
}

export type Person = { id: string; fullName: string; detail: string | null; at?: Date };

const person = (u: {
  id: string;
  fullName: string;
  position: string | null;
  department: { name: string } | null;
}): Person => ({
  id: u.id,
  fullName: u.fullName,
  detail: [u.position, u.department?.name].filter(Boolean).join(" · ") || null,
});

const USER_SELECT = {
  id: true,
  fullName: true,
  position: true,
  department: { select: { name: true } },
} as const;

export type DocumentSocial = {
  published: { at: Date; by: Person | null; message: string | null } | null;
  recipients: {
    all: boolean;
    departments: { id: string; name: string; count: number }[];
    users: Person[];
    total: number;
    /** Người nhận đã mở văn bản */
    viewed: number;
  };
  followers: Person[];
  following: boolean;
  viewers: Person[];
  downloaders: Person[];
  comments: {
    id: string;
    content: string;
    createdAt: Date;
    author: Person;
    mine: boolean;
    attachments: { id: string; fileName: string; sizeBytes: number; mimeType: string }[];
  }[];
};

export async function documentSocial(
  user: CurrentUser,
  documentId: string,
): Promise<DocumentSocial> {
  const [doc, shares, follows, views, downloads, comments] = await Promise.all([
    db.documentNode.findUniqueOrThrow({
      where: { id: documentId },
      select: {
        publishedAt: true,
        publishMessage: true,
        recipientAll: true,
        recipientDepartmentIds: true,
        publishedBy: { select: USER_SELECT },
      },
    }),
    db.documentShare.findMany({
      where: { documentId },
      select: {
        userId: true,
        direct: true,
        user: { select: { ...USER_SELECT, departmentId: true } },
      },
    }),
    db.documentFollow.findMany({
      where: { documentId },
      orderBy: { createdAt: "asc" },
      select: { user: { select: USER_SELECT } },
    }),
    db.documentView.findMany({
      where: { documentId },
      orderBy: { firstViewedAt: "asc" },
      select: { firstViewedAt: true, user: { select: USER_SELECT } },
    }),
    // "Đã tải tệp": nhật ký tải về (không tính xem trước)
    db.auditLog.findMany({
      where: {
        entity: "Attachment",
        action: "DOWNLOAD",
        after: { path: ["documentId"], equals: documentId },
        AND: [{ after: { path: ["mode"], equals: "download" } }],
        userId: { not: null },
      },
      orderBy: { createdAt: "asc" },
      distinct: ["userId"],
      select: { createdAt: true, user: { select: USER_SELECT } },
    }),
    db.documentComment.findMany({
      where: { documentId, deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        content: true,
        createdAt: true,
        userId: true,
        user: { select: USER_SELECT },
        attachments: {
          where: { deletedAt: null },
          orderBy: { createdAt: "asc" },
          select: { id: true, fileName: true, sizeBytes: true, mimeType: true },
        },
      },
    }),
  ]);

  const departments = doc.recipientDepartmentIds.length
    ? await db.department.findMany({
        where: { id: { in: doc.recipientDepartmentIds } },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true },
      })
    : [];
  const viewedIds = new Set(views.map((v) => v.user.id));

  return {
    published: doc.publishedAt
      ? {
          at: doc.publishedAt,
          by: doc.publishedBy ? person(doc.publishedBy) : null,
          message: doc.publishMessage,
        }
      : null,
    recipients: {
      all: doc.recipientAll,
      departments: departments.map((d) => ({
        ...d,
        count: shares.filter((s) => s.user.departmentId === d.id).length,
      })),
      users: shares.filter((s) => s.direct).map((s) => person(s.user)),
      total: shares.length,
      viewed: shares.filter((s) => viewedIds.has(s.userId)).length,
    },
    followers: follows.map((f) => person(f.user)),
    following: follows.some((f) => f.user.id === user.id),
    viewers: views.map((v) => ({ ...person(v.user), at: v.firstViewedAt })),
    downloaders: downloads
      .filter((d) => d.user)
      .map((d) => ({ ...person(d.user!), at: d.createdAt })),
    comments: comments.map((c) => ({
      id: c.id,
      content: c.content,
      createdAt: c.createdAt,
      author: person(c.user),
      mine: c.userId === user.id,
      attachments: c.attachments,
    })),
  };
}

// ---------------------------------------------------------------- Văn bản mới ban hành

export type PublishedItem = {
  id: string;
  title: string;
  number: string | null;
  typeName: string;
  typeColor: string;
  sender: string;
  publishedAt: Date;
  toMe: boolean;
  viewed: boolean;
  attachmentCount: number;
};

/**
 * Danh sách văn bản đã ban hành: "gửi đến tôi" hoặc tất cả trong phạm vi xem; mới nhất trước.
 * `chuaXem` = gửi đến tôi mà tôi chưa mở.
 */
export async function listPublished(
  user: CurrentUser,
  filter: "toi" | "tat-ca" | "chua-xem",
  limit = 200,
) {
  const scope = filter === "tat-ca" ? await documentScope(user) : null;
  const rows = await db.documentNode.findMany({
    where: {
      deletedAt: null,
      publishedAt: { not: null },
      ...(filter === "tat-ca"
        ? scope
          ? { id: { in: [...scope.direct] } }
          : {}
        : { shares: { some: { userId: user.id } } }),
      ...(filter === "chua-xem" ? { views: { none: { userId: user.id } } } : {}),
    },
    orderBy: { publishedAt: "desc" },
    take: limit,
    select: {
      id: true,
      title: true,
      number: true,
      publishedAt: true,
      type: { select: { name: true, color: true } },
      publishedBy: { select: { fullName: true, department: { select: { name: true } } } },
      shares: { where: { userId: user.id }, select: { userId: true } },
      views: { where: { userId: user.id }, select: { userId: true } },
      _count: { select: { attachments: { where: { deletedAt: null } } } },
    },
  });
  const unread = await db.documentNode.count({
    where: {
      deletedAt: null,
      publishedAt: { not: null },
      shares: { some: { userId: user.id } },
      views: { none: { userId: user.id } },
    },
  });
  const items: PublishedItem[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    number: r.number,
    typeName: r.type.name,
    typeColor: r.type.color,
    sender: r.publishedBy?.department?.name ?? r.publishedBy?.fullName ?? "—",
    publishedAt: r.publishedAt!,
    toMe: r.shares.length > 0,
    viewed: r.views.length > 0,
    attachmentCount: r._count.attachments,
  }));
  return { groups: groupByDay(items, new Date()), unread, total: items.length };
}
