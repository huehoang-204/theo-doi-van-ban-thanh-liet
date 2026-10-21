// Giai đoạn 5 trên CSDL thật: job 06:30 sinh thông báo nhắc hạn (tiêu chí nghiệm thu: việc còn 3 ngày → người
// chủ trì có thông báo sáng hôm đó), chạy lại không trùng; job đêm xoá vĩnh viễn Thùng rác quá 30 ngày.
import { randomUUID } from "node:crypto";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { CurrentUser } from "@/server/auth/current-user";

let currentUser: CurrentUser;

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/server/auth/current-user", () => ({
  getCurrentUser: async () => currentUser,
  clientIp: () => null,
}));

const uploadDir = await mkdtemp(path.join(tmpdir(), "webtl-jobs-"));
process.env.UPLOAD_DIR = uploadDir;

const { db } = await import("@/lib/db");
const docs = await import("@/server/actions/documents");
const { runDailyJob } = await import("@/server/jobs/daily");
const { runNightlyJob } = await import("@/server/jobs/nightly");
const { jobsToCatchUp, runJob } = await import("@/server/jobs/runner");
const { putFile } = await import("@/server/storage");

const RUN = randomUUID().slice(0, 8);
const NOW = new Date("2026-10-21T06:30:00+07:00"); // sáng 21/10
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

let deptId: string;
let lead: string; // người chủ trì
let mate: string; // cùng đơn vị
let inactive: string; // cùng đơn vị nhưng đã khoá
let assigner: string;
let follower: string;
let clerk: CurrentUser;
let typeId: string;

async function mkUser(roles: CurrentUser["roles"], departmentId: string | null, active = true) {
  const u = await db.user.create({
    data: {
      username: `j${randomUUID().slice(0, 10)}`,
      fullName: "Người thử job",
      roles: [...roles],
      departmentId,
      passwordHash: "x",
      mustChangePassword: false,
      active,
    },
  });
  return u.id;
}

const task = (title: string, due: string | null, extra: Record<string, unknown> = {}) =>
  db.task.create({
    data: {
      title: `${title} ${RUN}`,
      assignerId: assigner,
      leadDepartmentId: deptId,
      leadUserId: lead,
      dueDate: due ? day(due) : null,
      flow: "IN_PROGRESS",
      ...extra,
    },
  });

const notesFor = (link: string) =>
  db.notification.findMany({ where: { link }, orderBy: { userId: "asc" } });

beforeAll(async () => {
  deptId = (await db.department.create({ data: { name: `Đơn vị job ${RUN}` } })).id;
  lead = await mkUser(["OFFICER"], deptId);
  mate = await mkUser(["OFFICER"], deptId);
  inactive = await mkUser(["OFFICER"], deptId, false);
  assigner = await mkUser(["CLERK"], null);
  follower = await mkUser(["CLERK"], null);
  const clerkId = await mkUser(["CLERK"], null);
  clerk = {
    id: clerkId,
    username: "clerk",
    fullName: "Văn thư",
    position: null,
    roles: ["CLERK"],
    departmentId: null,
    departmentName: null,
    mustChangePassword: false,
    fontScale: 100,
  };
  currentUser = clerk;
  typeId = (await db.documentType.findFirstOrThrow({ where: { code: "CTr" } })).id;
});

afterAll(async () => {
  await rm(uploadDir, { recursive: true, force: true });
});

describe("job 06:30 — nhắc hạn (Mục 5.4)", () => {
  it("việc còn 3 ngày → người chủ trì có thông báo sáng hôm đó; chạy lại không sinh trùng", async () => {
    const t = await task("Rà soát hộ nghèo", "2026-10-24");
    await runDailyJob(db, NOW);
    const notes = await notesFor(`/cong-viec/${t.id}`);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({
      userId: lead,
      kind: "DUE_SOON",
      title: `Việc “Rà soát hộ nghèo ${RUN}” còn 3 ngày đến hạn (24/10/2026)`,
      readAt: null,
    });
    // Thông báo sinh "sáng hôm đó"
    expect(notes[0]!.createdAt.getTime()).toBeGreaterThan(Date.now() - 60_000);

    await runDailyJob(db, new Date("2026-10-21T15:00:00+07:00")); // chạy lại trong ngày
    expect(await notesFor(`/cong-viec/${t.id}`)).toHaveLength(1);
  });

  it("chỉ giao đơn vị → mọi tài khoản đang hoạt động của đơn vị; còn 1 ngày cũng nhắc", async () => {
    const t = await task("Tổng hợp số liệu", "2026-10-22", { leadUserId: null });
    await runDailyJob(db, NOW);
    const notes = await notesFor(`/cong-viec/${t.id}`);
    expect(notes.map((n) => n.userId).sort()).toEqual([lead, mate].sort());
    expect(notes.map((n) => n.userId)).not.toContain(inactive);
    expect(notes[0]!.title).toContain("còn 1 ngày đến hạn");
  });

  it("quá hạn: nhắc mỗi ngày tối đa 7 ngày; ngày đầu báo thêm người giao", async () => {
    const t = await task("Báo cáo tiến độ", "2026-10-20");
    const link = `/cong-viec/${t.id}`;
    await runDailyJob(db, NOW); // quá 1 ngày
    let notes = await notesFor(link);
    expect(notes.map((n) => n.userId).sort()).toEqual([lead, assigner].sort());
    expect(notes.find((n) => n.userId === assigner)!.title).toBe(
      `Việc bạn giao “Báo cáo tiến độ ${RUN}” đã quá hạn (hạn 20/10/2026)`,
    );
    await runDailyJob(db, new Date("2026-10-22T06:30:00+07:00")); // quá 2 ngày: chỉ người chủ trì
    notes = await notesFor(link);
    expect(notes.filter((n) => n.userId === lead)).toHaveLength(2);
    expect(notes.filter((n) => n.userId === assigner)).toHaveLength(1);
    expect(notes.some((n) => n.title.endsWith("đã quá hạn 2 ngày (hạn 20/10/2026)"))).toBe(true);
    await runDailyJob(db, new Date("2026-10-28T06:30:00+07:00")); // quá 8 ngày: thôi nhắc
    expect((await notesFor(link)).filter((n) => n.userId === lead)).toHaveLength(2);
  });

  it("không nhắc việc chờ duyệt / đã xong / đã huỷ / không hạn / còn 2 ngày", async () => {
    const ids = await Promise.all([
      task("Chờ duyệt", "2026-10-24", { flow: "SUBMITTED", submittedAt: NOW }),
      task("Đã xong", "2026-10-24", { flow: "DONE", completedAt: NOW }),
      task("Đã huỷ", "2026-10-24", { flow: "CANCELLED" }),
      task("Không hạn", null),
      task("Còn 2 ngày", "2026-10-23"),
    ]);
    await runDailyJob(db, NOW);
    for (const t of ids) expect(await notesFor(`/cong-viec/${t.id}`), t.title).toHaveLength(0);
  });

  it("kỳ báo cáo chưa nộp còn 3 ngày → đơn vị phải nộp; quá hạn ngày đầu → báo người theo dõi", async () => {
    const r = await docs.createDocument({
      parentId: null,
      typeId,
      title: `Chương trình job ${RUN}`,
      issuingAgencyText: "UBND phường",
      issuedDate: "12/01/2026",
      coDepartmentIds: [],
      tags: "",
      isInternalPublic: false,
    } as never);
    if (!r.ok) throw new Error(r.error.message);
    const req = await db.reportRequirement.create({
      data: {
        documentId: r.data.id,
        name: `Báo cáo KT-XH ${RUN}`,
        frequency: "ONCE",
        onceDueDate: day("2026-10-24"),
        startDate: day("2026-10-01"),
        departmentIds: [deptId],
        followerUserId: follower,
      },
    });
    const mkPeriod = (label: string, due: string) =>
      db.reportPeriod.create({
        data: {
          requirementId: req.id,
          label,
          periodStart: day(due),
          periodEnd: day(due),
          dueDate: day(due),
          departmentId: deptId,
        },
      });
    await mkPeriod("Tháng 10/2026", "2026-10-24");
    await mkPeriod("Tháng 09/2026", "2026-10-20");
    await runDailyJob(db, NOW);
    const notes = await notesFor(`/bao-cao?yeuCau=${req.id}`);
    const soon = notes.filter((n) => n.kind === "DUE_SOON");
    expect(soon.map((n) => n.userId).sort()).toEqual([lead, mate].sort());
    expect(soon[0]!.title).toBe(
      `Báo cáo “Báo cáo KT-XH ${RUN}” — Tháng 10/2026 còn 3 ngày đến hạn (24/10/2026)`,
    );
    const late = notes.filter((n) => n.kind === "OVERDUE");
    expect(late.map((n) => n.userId).sort()).toEqual([lead, mate, follower].sort());
  });

  it("worker ghi lần chạy; khởi động sau 06:30 mà hôm nay chưa chạy thì chạy bù", async () => {
    await db.setting.deleteMany({ where: { key: { in: ["job.daily", "job.nightly"] } } });
    expect(await jobsToCatchUp(db, new Date("2026-10-21T06:00:00+07:00"))).toEqual(["nightly"]);
    expect(await jobsToCatchUp(db, new Date("2026-10-21T08:00:00+07:00"))).toEqual([
      "nightly",
      "daily",
    ]);
    const rec = await runJob(db, "daily", NOW);
    expect(rec).toMatchObject({ ok: true, day: "2026-10-21" });
    expect(await jobsToCatchUp(db, new Date("2026-10-21T08:00:00+07:00"))).toEqual(["nightly"]);
  });
});

describe("job đêm — Thùng rác 30 ngày", () => {
  async function branch(title: string) {
    const root = await docs.createDocument({
      parentId: null,
      typeId,
      title: `${title} ${RUN}`,
      issuingAgencyText: "UBND phường",
      issuedDate: "12/01/2026",
      coDepartmentIds: [],
      tags: "",
      isInternalPublic: false,
    } as never);
    if (!root.ok) throw new Error(root.error.message);
    const child = await docs.createDocument({
      parentId: root.data.id,
      typeId: (await db.documentType.findFirstOrThrow({ where: { code: "KH" } })).id,
      title: `Con của ${title} ${RUN}`,
      issuingAgencyText: "UBND phường",
      issuedDate: "12/01/2026",
      coDepartmentIds: [],
      tags: "",
      isInternalPublic: false,
    } as never);
    if (!child.ok) throw new Error(child.error.message);
    return { root: root.data.id, child: child.data.id };
  }

  it("xoá vĩnh viễn nhánh quá 30 ngày (cả tệp trên ổ), giữ nhánh mới xoá 29 ngày", async () => {
    const old = await branch("Cũ");
    const recent = await branch("Mới");
    const key = `2026/09/${randomUUID()}`;
    await putFile(key, new TextEncoder().encode("%PDF-1.4 thử"));
    await db.attachment.create({
      data: {
        documentId: old.child,
        fileName: "ke-hoach.pdf",
        storageKey: key,
        mimeType: "application/pdf",
        sizeBytes: 12,
        checksum: "x",
        uploadedById: clerk.id,
      },
    });
    const linkedTask = await task("Việc của văn bản cũ", "2026-12-01", { documentId: old.child });
    for (const b of [old, recent]) {
      const r = await docs.deleteDocument({ id: b.root, cascade: true });
      expect(r.ok).toBe(true);
    }
    const now = new Date("2026-10-21T00:15:00+07:00");
    const at = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86_400_000);
    // Giả lập thời điểm xoá (cùng mốc cho cả nhánh)
    await db.documentNode.updateMany({
      where: { id: { in: [old.root, old.child] } },
      data: { deletedAt: at(31) },
    });
    await db.documentNode.updateMany({
      where: { id: { in: [recent.root, recent.child] } },
      data: { deletedAt: at(29) },
    });

    const result = await runNightlyJob(db, now);
    expect(result.trash.documents).toBeGreaterThanOrEqual(2);
    expect(result.trash.files).toBeGreaterThanOrEqual(1);
    expect(await db.documentNode.count({ where: { id: { in: [old.root, old.child] } } })).toBe(0);
    expect(
      await db.documentNode.count({ where: { id: { in: [recent.root, recent.child] } } }),
    ).toBe(2);
    expect(await db.attachment.count({ where: { storageKey: key } })).toBe(0);
    expect(await readdir(path.join(uploadDir, "2026/09"))).not.toContain(key.split("/")[2]);
    // Công việc giữ lại, bỏ liên kết văn bản
    expect(
      (await db.task.findUniqueOrThrow({ where: { id: linkedTask.id } })).documentId,
    ).toBeNull();
    // Nhật ký ghi PURGE (hệ thống, không có người thực hiện)
    const log = await db.auditLog.findFirst({ where: { action: "PURGE", entityId: old.root } });
    expect(log).toMatchObject({ userId: null, entity: "DocumentNode" });
    expect(log!.after).toMatchObject({ reason: "expired", count: 2 });
    // Đánh dấu đã tính lại tiến độ hôm nay → trang Văn bản không tính lại
    expect((await db.setting.findUnique({ where: { key: "progressRecomputedOn" } }))?.value).toBe(
      "2026-10-21",
    );
  });
});
