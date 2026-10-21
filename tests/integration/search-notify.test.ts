// Giai đoạn 5 trên CSDL thật: tìm kiếm Ctrl+K không dấu theo phạm vi xem; thông báo văn bản mới cho
// người theo dõi chương trình; đánh dấu đã đọc chỉ trên thông báo của chính mình.
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
const notes = await import("@/server/actions/notifications");
const { globalSearch } = await import("@/server/search/global");

const RUN = randomUUID().slice(0, 6);
// Từ khoá riêng cho lần chạy (chữ cái, không dấu khi tìm)
const KEY = `Rà soát hộ nghèo ${RUN}`;

const mkUser = async (
  roles: CurrentUser["roles"],
  departmentId: string | null,
): Promise<CurrentUser> => {
  const u = await db.user.create({
    data: {
      username: `s${randomUUID().slice(0, 10)}`,
      fullName: `Người ${roles[0]}`,
      roles: [...roles],
      departmentId,
      passwordHash: "x",
      mustChangePassword: false,
    },
  });
  return {
    id: u.id,
    username: u.username,
    fullName: u.fullName,
    position: null,
    roles: [...roles],
    departmentId,
    departmentName: null,
    mustChangePassword: false,
    fontScale: 100,
  };
};

let clerk: CurrentUser;
let leader: CurrentUser;
let officerA: CurrentUser;
let officerB: CurrentUser;
let types: Record<string, string>;

const create = async (title: string, parentId: string | null, typeCode: string, extra = {}) => {
  const r = await docs.createDocument({
    parentId,
    typeId: types[typeCode]!,
    title,
    issuingAgencyText: "UBND phường",
    issuedDate: "12/01/2026",
    coDepartmentIds: [],
    tags: "",
    isInternalPublic: false,
    ...extra,
  } as never);
  if (!r.ok) throw new Error(r.error.message);
  return r.data.id;
};

beforeAll(async () => {
  types = Object.fromEntries((await db.documentType.findMany()).map((t) => [t.code, t.id]));
  const deptA = (await db.department.create({ data: { name: `Đơn vị A ${RUN}` } })).id;
  const deptB = (await db.department.create({ data: { name: `Đơn vị B ${RUN}` } })).id;
  clerk = await mkUser(["CLERK"], null);
  leader = await mkUser(["LEADER"], null);
  officerA = await mkUser(["OFFICER"], deptA);
  officerB = await mkUser(["OFFICER"], deptB);
  await db.task.create({
    data: {
      title: KEY,
      assignerId: clerk.id,
      leadDepartmentId: deptA,
      dueDate: new Date("2026-12-01T00:00:00Z"),
    },
  });
  await db.school.create({ data: { name: `Trường Mầm non Hoa Sữa ${RUN}`, level: "MAM_NON" } });
});

describe("tìm kiếm toàn cục (Ctrl+K)", () => {
  it("gõ không dấu khớp tiếng Việt có dấu; nhóm theo loại; link mở danh sách đã lọc", async () => {
    const r = await globalSearch(clerk, `ra soat ngheo ${RUN}`);
    const tasks = r.groups.find((g) => g.key === "tasks");
    expect(tasks?.items.map((i) => i.title)).toEqual([KEY]);
    expect(tasks!.items[0]!.href).toMatch(/^\/cong-viec\/.+/);
    expect(tasks!.items[0]!.subtitle).toContain("hạn 01/12/2026");

    const school = (await globalSearch(clerk, `hoa sua ${RUN}`)).groups.find(
      (g) => g.key === "schools",
    );
    expect(school?.items[0]).toMatchObject({
      title: `Trường Mầm non Hoa Sữa ${RUN}`,
      href: `/dia-ban/truong-hoc?tim=${encodeURIComponent(`Trường Mầm non Hoa Sữa ${RUN}`)}`,
    });
  });

  it("theo phạm vi xem: cán bộ đơn vị khác không thấy công việc; từ khoá < 2 ký tự không tìm", async () => {
    expect((await globalSearch(officerA, `ra soat ${RUN}`)).groups.map((g) => g.key)).toContain(
      "tasks",
    );
    expect((await globalSearch(officerB, `ra soat ${RUN}`)).groups.map((g) => g.key)).not.toContain(
      "tasks",
    );
    expect((await globalSearch(clerk, "a")).groups).toEqual([]);
  });

  it("văn bản: tìm theo số/trích yếu không dấu", async () => {
    currentUser = clerk;
    const root = await create(`Chương trình đô thị văn minh ${RUN}`, null, "CTr");
    const r = await globalSearch(leader, `do thi van minh ${RUN}`);
    expect(r.groups.find((g) => g.key === "documents")?.items[0]).toMatchObject({
      id: root,
      href: `/van-ban/${root}`,
    });
  });
});

describe("thông báo văn bản mới trong chương trình mình theo dõi", () => {
  it("người theo dõi được báo, người tạo không; bỏ theo dõi thì thôi", async () => {
    currentUser = clerk;
    const root = await create(`Chương trình theo dõi ${RUN}`, null, "CTr");
    currentUser = leader;
    expect((await publishing.setDocumentFollow({ id: root, follow: true })).ok).toBe(true);
    currentUser = clerk;
    expect((await publishing.setDocumentFollow({ id: root, follow: true })).ok).toBe(true);

    const kh = await create(`Kế hoạch triển khai ${RUN}`, root, "KH", { number: `12/KH-${RUN}` });
    const n = await db.notification.findMany({ where: { link: `/van-ban/${kh}` } });
    expect(n.map((x) => x.userId)).toEqual([leader.id]); // clerk là người tạo
    expect(n[0]).toMatchObject({
      kind: "NEW_DOCUMENT",
      title: `Văn bản mới trong “Chương trình theo dõi ${RUN}”: 12/KH-${RUN} Kế hoạch triển khai ${RUN}`,
    });

    // Văn bản cháu (cấp 3) cũng báo theo chương trình gốc
    const child = await create(`Công văn hướng dẫn ${RUN}`, kh, "CV");
    expect(
      await db.notification.count({ where: { link: `/van-ban/${child}`, userId: leader.id } }),
    ).toBe(1);

    currentUser = leader;
    await publishing.setDocumentFollow({ id: root, follow: false });
    currentUser = clerk;
    const later = await create(`Báo cáo sơ kết ${RUN}`, root, "BC");
    expect(await db.notification.count({ where: { link: `/van-ban/${later}` } })).toBe(0);

    // Theo dõi một văn bản cấp 2 → được báo văn bản mới dưới nó
    currentUser = leader;
    expect((await publishing.setDocumentFollow({ id: kh, follow: true })).ok).toBe(true);
    currentUser = clerk;
    const under = await create(`Quyết định thành lập ${RUN}`, kh, "QD");
    expect(
      await db.notification.count({ where: { link: `/van-ban/${under}`, userId: leader.id } }),
    ).toBe(1);
  });

  it("đánh dấu đã đọc chỉ tác động thông báo của chính mình", async () => {
    const mine = await db.notification.create({
      data: {
        userId: officerA.id,
        kind: "TASK_ASSIGNED",
        title: "Việc mới",
        link: "/viec-cua-toi",
      },
    });
    const other = await db.notification.create({
      data: {
        userId: officerB.id,
        kind: "TASK_ASSIGNED",
        title: "Việc mới",
        link: "/viec-cua-toi",
      },
    });
    currentUser = officerA;
    await notes.markNotificationRead({ id: other.id });
    expect(
      (await db.notification.findUniqueOrThrow({ where: { id: other.id } })).readAt,
    ).toBeNull();
    await notes.markAllNotificationsRead({});
    expect(
      (await db.notification.findUniqueOrThrow({ where: { id: mine.id } })).readAt,
    ).not.toBeNull();
    expect(
      (await db.notification.findUniqueOrThrow({ where: { id: other.id } })).readAt,
    ).toBeNull();
  });
});
