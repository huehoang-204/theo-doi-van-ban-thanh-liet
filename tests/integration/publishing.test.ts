// GĐ5b trên CSDL thật: ban hành văn bản tới đơn vị/cá nhân/toàn phường, thông báo "… đã ban hành văn bản …",
// người nhận xem được, gửi bổ sung chỉ báo người mới, đã xem, thảo luận báo người theo dõi, danh sách mới ban hành.
import { randomUUID } from "node:crypto";

import { beforeAll, describe, expect, it, vi } from "vitest";

import type { CurrentUser } from "@/server/auth/current-user";

let currentUser: CurrentUser;

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/server/auth/current-user", () => ({
  getCurrentUser: async () => currentUser,
  clientIp: () => null,
}));

const { db } = await import("@/lib/db");
const docs = await import("@/server/actions/documents");
const publishing = await import("@/server/actions/publishing");
const { canViewDocument } = await import("@/server/documents/files");
const { documentSocial, listPublished, recordDocumentView } =
  await import("@/server/documents/social");

const RUN = randomUUID().slice(0, 6);
let deptA: string;
let deptB: string;
let clerk: CurrentUser;
let a1: CurrentUser;
let a2: CurrentUser;
let b1: CurrentUser;
let viewer: CurrentUser;
let docId: string;

async function mkUser(roles: CurrentUser["roles"], departmentId: string | null, name: string) {
  const u = await db.user.create({
    data: {
      username: `p${randomUUID().slice(0, 10)}`,
      fullName: name,
      roles: [...roles],
      departmentId,
      passwordHash: "x",
      mustChangePassword: false,
    },
  });
  return {
    id: u.id,
    username: u.username,
    fullName: name,
    position: null,
    roles: [...roles],
    departmentId,
    departmentName: null,
    mustChangePassword: false,
    fontScale: 100,
  } satisfies CurrentUser;
}

const ok = <T>(r: { ok: true; data: T } | { ok: false; error: { message: string } }): T => {
  if (!r.ok) throw new Error(r.error.message);
  return r.data;
};

beforeAll(async () => {
  deptA = (await db.department.create({ data: { name: `Phòng Nội vụ ${RUN}` } })).id;
  deptB = (await db.department.create({ data: { name: `Phòng Kinh tế ${RUN}` } })).id;
  clerk = await mkUser(["CLERK"], deptA, "Văn thư thử");
  a1 = await mkUser(["OFFICER"], deptA, "Cán bộ A1");
  a2 = await mkUser(["OFFICER"], deptA, "Cán bộ A2");
  b1 = await mkUser(["OFFICER"], deptB, "Cán bộ B1");
  viewer = await mkUser(["VIEWER"], null, "Tổ trưởng thử");
  const type = await db.documentType.findFirstOrThrow({ where: { code: "CTr" } });
  currentUser = clerk;
  docId = ok(
    await docs.createDocument({
      parentId: null,
      typeId: type.id,
      number: `15/CTr-${RUN}`,
      title: `Chương trình khen thưởng ${RUN}`,
      issuingAgencyText: "UBND phường",
      issuedDate: "15/10/2026",
      coDepartmentIds: [],
      tags: "",
      isInternalPublic: false,
    } as never),
  ).id;
});

describe("ban hành văn bản", () => {
  it("trước khi gửi: cán bộ đơn vị khác và người chỉ xem không xem được", async () => {
    expect(await canViewDocument(b1, docId)).toBe(false);
    expect(await canViewDocument(viewer, docId)).toBe(false);
  });

  it("phải chọn người nhận", async () => {
    currentUser = clerk;
    const r = await publishing.publishDocument({
      id: docId,
      all: false,
      departmentIds: [],
      userIds: [],
      message: "",
    });
    expect(r.ok).toBe(false);
  });

  it("gửi đơn vị A + đích danh người chỉ xem → thông báo kiểu văn bản điều hành; người nhận xem được", async () => {
    currentUser = clerk;
    const r = ok(
      await publishing.publishDocument({
        id: docId,
        all: false,
        departmentIds: [deptA],
        userIds: [viewer.id],
        message: "Kính gửi các đơn vị. Đề nghị triển khai.",
      }),
    );
    expect(r).toEqual({ added: 3, total: 3, firstTime: true }); // a1, a2, viewer (không gồm người gửi)
    const notes = await db.notification.findMany({
      where: { link: `/van-ban/${docId}`, kind: "DOCUMENT_PUBLISHED" },
    });
    expect(notes.map((n) => n.userId).sort()).toEqual([a1.id, a2.id, viewer.id].sort());
    expect(notes[0]!.title).toBe(
      `PHÒNG NỘI VỤ ${RUN.toUpperCase()} đã ban hành văn bản Chương trình khen thưởng ${RUN} [15/CTr-${RUN}]`,
    );
    expect(await canViewDocument(viewer, docId)).toBe(true);
    expect(await canViewDocument(b1, docId)).toBe(false);
    // Người gửi tự theo dõi; nhật ký PUBLISH
    expect(await db.documentFollow.count({ where: { documentId: docId, userId: clerk.id } })).toBe(
      1,
    );
    expect(await db.auditLog.count({ where: { action: "PUBLISH", entityId: docId } })).toBe(1);
  });

  it("gửi bổ sung đơn vị B: chỉ người mới được báo, giữ mốc ban hành đầu", async () => {
    const first = (await db.documentNode.findUniqueOrThrow({ where: { id: docId } })).publishedAt;
    currentUser = clerk;
    const r = ok(
      await publishing.publishDocument({
        id: docId,
        all: false,
        departmentIds: [deptB, deptA],
        userIds: [],
        message: "",
      }),
    );
    expect(r).toEqual({ added: 1, total: 4, firstTime: false });
    expect(
      await db.notification.count({
        where: { link: `/van-ban/${docId}`, kind: "DOCUMENT_PUBLISHED" },
      }),
    ).toBe(4);
    const node = await db.documentNode.findUniqueOrThrow({ where: { id: docId } });
    expect(node.publishedAt).toEqual(first);
    expect(node.publishMessage).toBe("Kính gửi các đơn vị. Đề nghị triển khai."); // không ghi đè bằng lời trống
    expect(node.recipientDepartmentIds.sort()).toEqual([deptA, deptB].sort());
    expect(await canViewDocument(b1, docId)).toBe(true);
  });

  it("mở văn bản: ghi đã xem, thông báo của văn bản coi như đã đọc; danh sách gửi đến tôi / chưa xem", async () => {
    expect(
      (await listPublished(a1, "chua-xem")).groups.flatMap((g) => g.items).map((i) => i.id),
    ).toContain(docId);
    await recordDocumentView(a1, docId);
    await recordDocumentView(a1, docId);
    const v = await db.documentView.findUniqueOrThrow({
      where: { documentId_userId: { documentId: docId, userId: a1.id } },
    });
    expect(v.viewCount).toBe(2);
    expect(
      await db.notification.count({
        where: { userId: a1.id, link: `/van-ban/${docId}`, readAt: null },
      }),
    ).toBe(0);
    expect(
      (await listPublished(a1, "chua-xem")).groups.flatMap((g) => g.items).map((i) => i.id),
    ).not.toContain(docId);
    const mine = (await listPublished(a1, "toi")).groups
      .flatMap((g) => g.items)
      .find((i) => i.id === docId);
    expect(mine).toMatchObject({ toMe: true, viewed: true, sender: `Phòng Nội vụ ${RUN}` });

    const social = await documentSocial(a1, docId);
    expect(social.recipients).toMatchObject({ total: 4, viewed: 1, all: false });
    expect(social.recipients.departments.map((d) => [d.name, d.count])).toEqual(
      expect.arrayContaining([
        [`Phòng Nội vụ ${RUN}`, 2],
        [`Phòng Kinh tế ${RUN}`, 1],
      ]),
    );
    expect(social.recipients.users.map((u) => u.fullName)).toEqual(["Tổ trưởng thử"]);
    expect(social.viewers.map((u) => u.fullName)).toEqual(["Cán bộ A1"]);
  });
});

describe("thảo luận & theo dõi", () => {
  it("người nhận thảo luận → người theo dõi (người gửi) được báo; người viết tự theo dõi; xoá của mình", async () => {
    currentUser = b1;
    const c = ok(
      await publishing.addComment({
        documentId: docId,
        content: "  Phòng Kinh tế đã nhận,\n sẽ triển khai.  ",
      }),
    );
    const n = await db.notification.findMany({
      where: { kind: "DOCUMENT_COMMENT", link: `/van-ban/${docId}#thao-luan` },
    });
    expect(n.map((x) => x.userId)).toEqual([clerk.id]);
    expect(n[0]!.title).toBe(
      `Cán bộ B1 thảo luận trong “15/CTr-${RUN}”: Phòng Kinh tế đã nhận, sẽ triển khai.`,
    );
    expect(await db.documentFollow.count({ where: { documentId: docId, userId: b1.id } })).toBe(1);

    // Người khác không xoá được; người viết xoá được
    currentUser = a1;
    expect((await publishing.deleteComment({ id: c.id })).ok).toBe(false);
    currentUser = b1;
    expect((await publishing.deleteComment({ id: c.id })).ok).toBe(true);
    expect((await documentSocial(b1, docId)).comments).toHaveLength(0);
  });

  it("không xem được văn bản thì không thảo luận / theo dõi được; nội dung trống bị từ chối", async () => {
    const other = await mkUser(["OFFICER"], null, "Người ngoài");
    currentUser = other;
    expect((await publishing.addComment({ documentId: docId, content: "xin chào" })).ok).toBe(
      false,
    );
    expect((await publishing.setDocumentFollow({ id: docId, follow: true })).ok).toBe(false);
    currentUser = a1;
    const r = await publishing.addComment({ documentId: docId, content: "   " });
    expect(r.ok).toBe(false);
  });

  it("toàn phường: mọi tài khoản đang hoạt động trở thành người nhận", async () => {
    currentUser = clerk;
    const r = ok(
      await publishing.publishDocument({
        id: docId,
        all: true,
        departmentIds: [],
        userIds: [],
        message: "",
      }),
    );
    const active = await db.user.count({ where: { active: true, id: { not: clerk.id } } });
    expect(r.total).toBe(active);
    expect((await db.documentNode.findUniqueOrThrow({ where: { id: docId } })).recipientAll).toBe(
      true,
    );
  });
});
