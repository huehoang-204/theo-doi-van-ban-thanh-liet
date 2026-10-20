// Cây văn bản trên CSDL thật: tạo đủ 5 cấp, chặn cấp 6, di chuyển cập nhật path cả cây con trong
// một transaction (lỗi thì không đổi gì), xoá mềm/khôi phục cả nhánh, tìm không dấu, phạm vi OFFICER.
import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { CurrentUser } from "@/server/auth/current-user";

let currentUser: CurrentUser;

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/server/auth/current-user", () => ({
  getCurrentUser: async () => currentUser,
  clientIp: () => null,
}));

const { db } = await import("@/lib/db");
const actions = await import("@/server/actions/documents");
const { listChildren, searchDocuments, revealNodes } = await import("@/server/documents/queries");

const RUN = randomUUID().slice(0, 8); // tách dữ liệu giữa các lần chạy
let types: Record<string, string>;
let deptA: string;

function userOf(roles: CurrentUser["roles"], departmentId: string | null = null): CurrentUser {
  return {
    id: currentUser?.id ?? "",
    username: "test",
    fullName: "Người thử",
    position: null,
    roles,
    departmentId,
    departmentName: null,
    mustChangePassword: false,
    fontScale: 100,
  };
}

const doc = (
  typeCode: string,
  title: string,
  parentId: string | null = null,
  extra: Record<string, unknown> = {},
) => ({
  parentId,
  typeId: types[typeCode]!,
  title: `${title} ${RUN}`,
  issuingAgencyText: "UBND phường",
  issuedDate: "12/01/2026",
  coDepartmentIds: [],
  tags: "",
  isInternalPublic: false,
  ...extra,
});

async function create(
  typeCode: string,
  title: string,
  parentId: string | null = null,
  extra: Record<string, unknown> = {},
) {
  const r = await actions.createDocument(doc(typeCode, title, parentId, extra) as never);
  if (!r.ok) throw new Error(r.error.message);
  return r.data.id;
}

const node = (id: string) => db.documentNode.findUniqueOrThrow({ where: { id } });

beforeAll(async () => {
  types = Object.fromEntries((await db.documentType.findMany()).map((t) => [t.code, t.id]));
  deptA = (
    await db.department.findFirstOrThrow({ where: { name: "Phòng Kinh tế, Hạ tầng và Đô thị" } })
  ).id;
  const admin = await db.user.findUniqueOrThrow({ where: { username: "admin" } });
  currentUser = { ...userOf(["CLERK"]), id: admin.id };
});

beforeEach(() => {
  currentUser = { ...userOf(["CLERK"]), id: currentUser.id };
});

afterAll(async () => {
  await db.$disconnect();
});

describe("tạo cây 5 cấp", () => {
  it("tạo đủ 5 cấp; path/depth/rootId đúng; cấp 6 bị từ chối", async () => {
    const ct = await create("CTr", "CT kiểm thử");
    const kh = await create("KH", "Kế hoạch", ct);
    const qd = await create("QD", "Quyết định", kh);
    const qc = await create("QC", "Quy chế", qd);
    const bc = await create("BC", "Báo cáo", qc);
    const leaf = await node(bc);
    expect(leaf).toMatchObject({
      depth: 5,
      rootId: ct,
      path: `/${ct}/${kh}/${qd}/${qc}/${bc}/`,
      parentId: qc,
    });

    const r = await actions.createDocument(doc("BC", "Cấp 6", bc) as never);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.message).toMatch(/đã ở cấp 5, cây chỉ có tối đa 5 cấp/);
  });

  it("cấp 1 phải là Chương trình", async () => {
    const r = await actions.createDocument(doc("KH", "Kế hoạch mồ côi") as never);
    expect(!r.ok && r.error.fieldErrors?.typeId).toBe(
      "Văn bản cấp 1 phải thuộc loại “Chương trình”.",
    );
  });

  it("thứ tự anh em tăng dần khi thêm", async () => {
    const ct = await create("CTr", "CT thứ tự");
    const a = await create("KH", "A", ct);
    const b = await create("KH", "B", ct);
    expect((await node(b)).sortOrder).toBe((await node(a)).sortOrder + 1);
  });
});

describe("di chuyển trong một transaction", () => {
  it("nghiệm thu: kéo nhánh 3 cấp vào nút cấp 3 bị từ chối, CSDL không đổi", async () => {
    const p1 = await create("CTr", "P1");
    const x = await create("KH", "X", p1); // cấp 2
    const y = await create("QD", "Y", x); // cấp 3
    const z = await create("QC", "Z", y); // cấp 4 → nhánh X có 3 cấp
    const p2 = await create("CTr", "P2");
    const r2 = await create("KH", "R", p2);
    const s3 = await create("QD", "S", r2); // cấp 3
    const before = await db.documentNode.findMany({
      where: { id: { in: [x, y, z] } },
      orderBy: { depth: "asc" },
    });

    const r = await actions.moveDocument({ id: x, newParentId: s3, index: 0 });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.message).toMatch(
      /nhánh .* có 3 cấp, đặt vào .* \(cấp 3\) thì nhánh sẽ xuống tới cấp 6, vượt quá tối đa 5 cấp/,
    );
    const after = await db.documentNode.findMany({
      where: { id: { in: [x, y, z] } },
      orderBy: { depth: "asc" },
    });
    expect(after.map((n) => [n.path, n.depth, n.rootId, n.parentId])).toEqual(
      before.map((n) => [n.path, n.depth, n.rootId, n.parentId]),
    );
  });

  it("chuyển nhánh sang chương trình khác: cập nhật path/depth/rootId cho cả cây con (kể cả nút đã xoá mềm)", async () => {
    const p1 = await create("CTr", "Nguồn");
    const x = await create("KH", "X", p1);
    const y = await create("QD", "Y", x);
    const z = await create("QC", "Z", y);
    const gone = await create("PL", "Phụ lục đã xoá", y);
    expect((await actions.deleteDocument({ id: gone, cascade: false })).ok).toBe(true);
    const p2 = await create("CTr", "Đích");
    const r2 = await create("KH", "R", p2);

    const r = await actions.moveDocument({ id: x, newParentId: r2, index: 0 });
    expect(r.ok).toBe(true);
    expect(await node(x)).toMatchObject({
      parentId: r2,
      depth: 3,
      rootId: p2,
      path: `/${p2}/${r2}/${x}/`,
    });
    expect(await node(y)).toMatchObject({
      parentId: x,
      depth: 4,
      rootId: p2,
      path: `/${p2}/${r2}/${x}/${y}/`,
    });
    expect(await node(z)).toMatchObject({
      depth: 5,
      rootId: p2,
      path: `/${p2}/${r2}/${x}/${y}/${z}/`,
    });
    expect(await node(gone)).toMatchObject({
      depth: 5,
      rootId: p2,
      path: `/${p2}/${r2}/${x}/${y}/${gone}/`,
    });
    expect(await listChildren(currentUser, p1)).toEqual([]);
  });

  it("chặn chuyển vào chính con cháu của nó", async () => {
    const p = await create("CTr", "Vòng lặp");
    const a = await create("KH", "A", p);
    const b = await create("QD", "B", a);
    const r = await actions.moveDocument({ id: a, newParentId: b, index: 0 });
    expect(!r.ok && r.error.message).toMatch(/vì đó là văn bản con\/cháu của chính nó/);
  });

  it("sắp xếp lại trong cùng cha (kéo-thả)", async () => {
    const p = await create("CTr", "Sắp xếp");
    const a = await create("KH", "A", p);
    const b = await create("KH", "B", p);
    const c = await create("KH", "C", p);
    expect((await actions.moveDocument({ id: c, newParentId: p, index: 0 })).ok).toBe(true);
    expect((await listChildren(currentUser, p)).map((n) => n.id)).toEqual([c, a, b]);
  });

  it("đưa Chương trình con lên cấp 1 → con cháu lấy nó làm gốc", async () => {
    const p = await create("CTr", "Cha");
    const sub = await create("CTr", "Chương trình con", p);
    const k = await create("KH", "K", sub);
    expect((await actions.moveDocument({ id: sub, newParentId: null, index: 0 })).ok).toBe(true);
    expect(await node(sub)).toMatchObject({
      parentId: null,
      depth: 1,
      rootId: null,
      path: `/${sub}/`,
    });
    expect(await node(k)).toMatchObject({ depth: 2, rootId: sub });
  });
});

describe("xoá mềm & khôi phục", () => {
  it("nút còn con: phải xác nhận xoá cả nhánh; khôi phục cả nhánh; con không khôi phục được khi cha còn trong thùng rác", async () => {
    const p = await create("CTr", "Xoá");
    const a = await create("KH", "A", p);
    const b = await create("QD", "B", a);

    const refused = await actions.deleteDocument({ id: a, cascade: false });
    expect(!refused.ok && refused.error.message).toBe(
      "Văn bản còn 1 văn bản con/cháu. Hãy xác nhận “Xoá cả nhánh” nếu muốn xoá.",
    );

    expect(await actions.deleteDocument({ id: a, cascade: true })).toMatchObject({
      ok: true,
      data: { count: 2 },
    });
    expect((await node(a)).deletedAt).not.toBeNull();
    expect((await node(b)).deletedAt).not.toBeNull();
    expect(await listChildren(currentUser, p)).toEqual([]);

    const child = await actions.restoreDocument({ id: b });
    expect(!child.ok && child.error.message).toMatch(
      /cũng đang ở Thùng rác — hãy khôi phục văn bản cha trước/,
    );

    expect(await actions.restoreDocument({ id: a })).toMatchObject({
      ok: true,
      data: { count: 2 },
    });
    expect((await node(b)).deletedAt).toBeNull();
  });

  it("CLERK chỉ xoá được văn bản do mình tạo", async () => {
    const p = await create("CTr", "Của người khác");
    const other = await db.user.create({
      data: {
        username: `u${RUN}`,
        fullName: "Khác",
        roles: ["CLERK"],
        passwordHash: "x",
        mustChangePassword: false,
      },
    });
    const saved = currentUser;
    currentUser = { ...userOf(["CLERK"]), id: other.id };
    const r = await actions.deleteDocument({ id: p, cascade: true });
    expect(!r.ok && r.error.code).toBe("FORBIDDEN");
    currentUser = saved;
  });
});

describe("tìm kiếm không dấu (unaccent + pg_trgm)", () => {
  it("nghiệm thu: “quyet dinh thanh lap” ra “Quyết định thành lập…”", async () => {
    const p = await create("CTr", "Chương trình tìm kiếm");
    const kh = await create("KH", "Kế hoạch chuyển đổi số", p);
    const qd = await create("QD", "Thành lập Tổ công tác chuyển đổi số", kh, {
      number: `45/QĐ-UBND-${RUN}`,
    });
    const { hits } = await searchDocuments(currentUser, { q: `quyet dinh thanh lap ${RUN}` });
    expect(hits.map((h) => h.id)).toEqual([qd]);
    expect(hits[0]!.trail).toContain("Chương trình tìm kiếm");
    // Gõ có dấu, chữ hoa, "đ" đều khớp
    expect(
      (await searchDocuments(currentUser, { q: `QUYẾT ĐỊNH ${RUN}` })).hits.map((h) => h.id),
    ).toContain(qd);
    expect(
      (await searchDocuments(currentUser, { q: `45/qd-ubnd-${RUN}` })).hits.map((h) => h.id),
    ).toEqual([qd]);
    // Tự mở nhánh: trả về con của các tổ tiên để cây mở tới kết quả
    const reveal = await revealNodes(currentUser, [qd]);
    expect(reveal.expand).toEqual([p, kh]);
    expect(reveal.nodes.map((n) => n.id)).toEqual(expect.arrayContaining([p, kh, qd]));
  });

  it("ký tự đặc biệt của LIKE không làm khớp nhầm", async () => {
    expect((await searchDocuments(currentUser, { q: `%%% ${RUN}` })).hits).toEqual([]);
  });
});

describe("phạm vi xem của cán bộ (OFFICER)", () => {
  it("thấy văn bản đơn vị mình chủ trì; tổ tiên hiện để giữ cấu trúc nhưng bị đánh dấu hạn chế", async () => {
    const p = await create("CTr", "Phạm vi");
    const hidden = await create("KH", "Không liên quan", p);
    const mine = await create("KH", "Đơn vị A chủ trì", p, { leadDepartmentId: deptA });
    currentUser = { ...userOf(["OFFICER"], deptA), id: currentUser.id };
    const roots = await listChildren(currentUser, null);
    const root = roots.find((n) => n.id === p);
    expect(root).toMatchObject({ restricted: true, childCount: 1 });
    expect((await listChildren(currentUser, p)).map((n) => [n.id, n.restricted])).toEqual([
      [mine, false],
    ]);
    expect((await searchDocuments(currentUser, { q: `khong lien quan ${RUN}` })).hits).toEqual([]);
    expect(hidden).toBeTruthy();
  });
});
