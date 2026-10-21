// Giai đoạn 3 trên CSDL thật: sinh kỳ báo cáo, nộp trễ, tự tạo văn bản con, luồng công việc,
// tiến độ cộng dồn & chấm đỏ lên cây.
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
const docs = await import("@/server/actions/documents");
const reports = await import("@/server/actions/reports");
const tasks = await import("@/server/actions/tasks");
const { listPeriods } = await import("@/server/reports/queries");
const { getTaskDetail } = await import("@/server/tasks/queries");

const RUN = randomUUID().slice(0, 8);
let types: Record<string, string>;
let depts: string[];
let clerk: CurrentUser;
let officer: CurrentUser;

const user = (
  id: string,
  roles: CurrentUser["roles"],
  departmentId: string | null,
): CurrentUser => ({
  id,
  username: id,
  fullName: `Người ${id.slice(0, 4)}`,
  position: null,
  roles,
  departmentId,
  departmentName: null,
  mustChangePassword: false,
  fontScale: 100,
});

async function createDoc(typeCode: string, title: string, parentId: string | null = null) {
  const r = await docs.createDocument({
    parentId,
    typeId: types[typeCode]!,
    title: `${title} ${RUN}`,
    issuingAgencyText: "UBND phường",
    issuedDate: "12/01/2026",
    coDepartmentIds: [],
    tags: "",
    isInternalPublic: false,
  } as never);
  if (!r.ok) throw new Error(r.error.message);
  return r.data.id;
}

function ok<T>(r: { ok: true; data: T } | { ok: false; error: { message: string } }): T {
  if (!r.ok) throw new Error(r.error.message);
  return r.data;
}

beforeAll(async () => {
  types = Object.fromEntries((await db.documentType.findMany()).map((t) => [t.code, t.id]));
  depts = (await db.department.findMany({ orderBy: { sortOrder: "asc" }, take: 3 })).map(
    (d) => d.id,
  );
  const mk = async (roles: CurrentUser["roles"], departmentId: string | null) => {
    const u = await db.user.create({
      data: {
        username: `t${randomUUID().slice(0, 10)}`,
        fullName: "Thử",
        roles: [...roles],
        departmentId,
        passwordHash: "x",
        mustChangePassword: false,
      },
    });
    return user(u.id, roles, departmentId);
  };
  clerk = await mk(["CLERK"], depts[0]!);
  officer = await mk(["OFFICER"], depts[1]!);
});

beforeEach(() => {
  currentUser = clerk;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("yêu cầu báo cáo & kỳ báo cáo", () => {
  it("nghiệm thu: hằng tháng ngày 20, 01/2026–12/2026, 3 đơn vị → đúng 36 kỳ; nộp ngày 21 → Đã nộp trễ", async () => {
    const program = await createDoc("CTr", "CT báo cáo");
    const cv = await createDoc("CV", "Công văn yêu cầu báo cáo", program);
    const saved = ok(
      await reports.saveRequirement({
        documentId: cv,
        name: `Báo cáo tháng ${RUN}`,
        frequency: "MONTHLY",
        dueDayOfPeriod: "20",
        dueMonthOffset: "0",
        startDate: "01/01/2026",
        endDate: "31/12/2026",
        departmentIds: depts,
        autoCreateChild: true,
        active: true,
      } as never),
    );
    expect(saved.periods).toBe(36);
    const periods = await db.reportPeriod.findMany({
      where: { requirementId: saved.id },
      orderBy: [{ dueDate: "asc" }],
    });
    expect(periods).toHaveLength(36);
    expect(new Set(periods.map((p) => p.departmentId))).toEqual(new Set(depts));
    expect(
      periods
        .filter((p) => p.departmentId === depts[0])
        .map((p) => p.dueDate.toISOString().slice(0, 10)),
    ).toContain("2026-01-20");

    // Nộp kỳ tháng 01 của đơn vị 1 vào ngày 21/01/2026
    const jan = periods.find((p) => p.departmentId === depts[0] && p.label === "Tháng 01/2026")!;
    const sub = ok(
      await reports.submitReport({
        periodId: jan.id,
        number: "15/BC-UBND",
        sentDate: "21/01/2026",
        note: "Kết quả tháng 1",
      } as never),
    );
    const item = (await listPeriods(clerk, { id: jan.id }))[0]!;
    expect(item.status).toBe("HOAN_THANH_TRE"); // hiển thị "Đã nộp trễ"

    // Tự tạo văn bản con của văn bản yêu cầu (cấp 3 dưới công văn cấp 2)
    expect(sub.linkedDocumentId).toBeTruthy();
    const child = await db.documentNode.findUniqueOrThrow({
      where: { id: sub.linkedDocumentId! },
      include: { type: true },
    });
    expect(child).toMatchObject({ parentId: cv, depth: 3, number: "15/BC-UBND" });
    expect(child.type.code).toBe("BC");
    expect(child.title).toContain("Tháng 01/2026");

    // Không nộp hai lần cùng kỳ
    const again = await reports.submitReport({ periodId: jan.id, sentDate: "22/01/2026" } as never);
    expect(!again.ok && again.error.code).toBe("ALREADY_SUBMITTED");

    // Nộp đúng hạn
    const feb = periods.find((p) => p.departmentId === depts[1] && p.label === "Tháng 02/2026")!;
    ok(await reports.submitReport({ periodId: feb.id, sentDate: "20/02/2026" } as never));
    expect((await listPeriods(clerk, { id: feb.id }))[0]!.status).toBe("HOAN_THANH");
  });

  it("văn bản yêu cầu ở cấp 5 → báo cáo chỉ lưu ở tab Báo cáo, không thêm vào cây", async () => {
    let parent: string | null = null;
    for (const code of ["CTr", "KH", "QD", "QC", "CV"])
      parent = await createDoc(code, `Cấp ${code}`, parent);
    const saved = ok(
      await reports.saveRequirement({
        documentId: parent,
        name: `Báo cáo một lần ${RUN}`,
        frequency: "ONCE",
        onceDueDate: "30/11/2026",
        startDate: "01/10/2026",
        departmentIds: [depts[0]],
        autoCreateChild: true,
        active: true,
      } as never),
    );
    expect(saved.periods).toBe(1);
    const period = await db.reportPeriod.findFirstOrThrow({ where: { requirementId: saved.id } });
    const sub = ok(
      await reports.submitReport({ periodId: period.id, sentDate: "15/10/2026" } as never),
    );
    expect(sub.linkedDocumentId).toBeNull();
    expect(sub.childNote).toMatch(/đã ở cấp 5/);
  });

  it("sửa yêu cầu: sinh lại kỳ tương lai chưa nộp; giữ kỳ đã nộp", async () => {
    const program = await createDoc("CTr", "CT sửa yêu cầu");
    const saved = ok(
      await reports.saveRequirement({
        documentId: program,
        name: `Báo cáo quý ${RUN}`,
        frequency: "QUARTERLY",
        dueDayOfPeriod: "15",
        startDate: "01/01/2026",
        endDate: "31/12/2027",
        departmentIds: [depts[0]],
        autoCreateChild: false,
        active: true,
      } as never),
    );
    expect(saved.periods).toBe(8);
    const q1 = await db.reportPeriod.findFirstOrThrow({
      where: { requirementId: saved.id, label: "Quý I/2026" },
    });
    ok(await reports.submitReport({ periodId: q1.id, sentDate: "10/03/2026" } as never));

    const updated = ok(
      await reports.saveRequirement({
        id: saved.id,
        documentId: program,
        name: `Báo cáo quý ${RUN}`,
        frequency: "QUARTERLY",
        dueDayOfPeriod: "25",
        startDate: "01/01/2026",
        endDate: "31/12/2027",
        departmentIds: [depts[0], depts[1]],
        autoCreateChild: false,
        active: true,
      } as never),
    );
    expect(updated.removed).toBeGreaterThan(0);
    const all = await db.reportPeriod.findMany({
      where: { requirementId: saved.id },
      include: { submission: true },
    });
    expect(all.find((p) => p.id === q1.id)?.submission).toBeTruthy(); // kỳ đã nộp còn nguyên
    expect(all.filter((p) => p.departmentId === depts[1])).toHaveLength(8); // đơn vị mới đủ 8 kỳ
    const future = all.filter((p) => p.dueDate > new Date() && p.departmentId === depts[0]);
    expect(future.every((p) => p.dueDate.getUTCDate() === 25)).toBe(true);
  });

  it("OFFICER chỉ nộp được cho đơn vị mình", async () => {
    const program = await createDoc("CTr", "CT quyền nộp");
    const saved = ok(
      await reports.saveRequirement({
        documentId: program,
        name: `Báo cáo quyền ${RUN}`,
        frequency: "ONCE",
        onceDueDate: "30/12/2026",
        startDate: "01/10/2026",
        departmentIds: [depts[0], depts[1]],
        autoCreateChild: false,
        active: true,
      } as never),
    );
    const [other, mine] = await Promise.all(
      [depts[0], depts[1]].map((d) =>
        db.reportPeriod.findFirstOrThrow({ where: { requirementId: saved.id, departmentId: d } }),
      ),
    );
    currentUser = officer;
    const denied = await reports.submitReport({
      periodId: other!.id,
      sentDate: "01/10/2026",
    } as never);
    expect(!denied.ok && denied.error.code).toBe("FORBIDDEN");
    expect(
      (await reports.submitReport({ periodId: mine!.id, sentDate: "01/10/2026" } as never)).ok,
    ).toBe(true);
  });
});

describe("công việc & tiến độ cộng dồn lên cây", () => {
  it("giao → cập nhật → báo hoàn thành → trả lại → báo lại → duyệt; tiến độ & chấm đỏ cập nhật trên cây", async () => {
    const program = await createDoc("CTr", "CT công việc");
    const kh = await createDoc("KH", "Kế hoạch có việc", program);
    await createDoc("QC", "Quy chế không có việc", kh); // không kéo tiến độ xuống

    const { id } = ok(
      await tasks.saveTask({
        title: `Việc quá hạn ${RUN}`,
        documentId: kh,
        leadUserId: officer.id,
        leadDepartmentId: officer.departmentId,
        dueDate: "01/01/2026",
        priority: "HIGH",
        coDepartmentIds: [],
        coUserIds: [],
      } as never),
    );
    const node = () =>
      db.documentNode.findUniqueOrThrow({
        where: { id: kh },
        select: { progressCache: true, hasOverdueDescendant: true },
      });
    const root = () =>
      db.documentNode.findUniqueOrThrow({
        where: { id: program },
        select: { progressCache: true, hasOverdueDescendant: true },
      });
    expect(await node()).toEqual({ progressCache: 0, hasOverdueDescendant: true });
    expect(await root()).toEqual({ progressCache: 0, hasOverdueDescendant: true });
    expect(
      await db.notification.count({ where: { userId: officer.id, kind: "TASK_ASSIGNED" } }),
    ).toBeGreaterThan(0);

    currentUser = officer;
    const bad = await tasks.postTaskUpdate({ taskId: id, progress: 55, content: "x" } as never);
    expect(!bad.ok && bad.error.fieldErrors?.progress).toBe("Tiến độ theo bước 10%.");
    ok(await tasks.postTaskUpdate({ taskId: id, progress: 60, content: "Đã làm 60%" } as never));
    expect((await node()).progressCache).toBe(60);
    expect((await root()).progressCache).toBe(60);

    // Duyệt khi chưa báo hoàn thành → bị chặn
    currentUser = clerk;
    const early = await tasks.approveTask({ taskId: id } as never);
    expect(!early.ok && early.error.message).toBe("Công việc chưa được báo hoàn thành.");

    currentUser = officer;
    ok(await tasks.submitTask({ taskId: id, content: "Đã xong" } as never));
    // Báo hoàn thành (dù trễ) → không còn "đang quá hạn" chờ người giao
    expect(await node()).toEqual({ progressCache: 100, hasOverdueDescendant: false });

    currentUser = clerk;
    ok(await tasks.returnTask({ taskId: id, note: "Thiếu minh chứng" } as never));
    let detail = (await getTaskDetail(clerk, id))!;
    expect(detail.task.flow).toBe("IN_PROGRESS");
    expect(detail.task.progress).toBe(60);
    expect(await node()).toEqual({ progressCache: 60, hasOverdueDescendant: true });

    currentUser = officer;
    ok(await tasks.submitTask({ taskId: id, content: "Đã bổ sung minh chứng" } as never));
    currentUser = clerk;
    ok(await tasks.approveTask({ taskId: id, note: "Đạt" } as never));
    detail = (await getTaskDetail(clerk, id))!;
    expect(detail.task.flow).toBe("DONE");
    expect(detail.task.completedAt?.getTime()).toBe(detail.task.submittedAt?.getTime()); // D3
    expect(detail.status).toBe("HOAN_THANH_TRE");
    expect(detail.task.updates.map((u) => u.kind)).toEqual([
      "APPROVE",
      "SUBMIT",
      "RETURN",
      "SUBMIT",
      "PROGRESS",
      "ASSIGN",
    ]);
    expect(await node()).toEqual({ progressCache: 100, hasOverdueDescendant: false });
  });

  it("gia hạn: hạn mới phải sau hạn cũ; duyệt thì đổi hạn; không có hai đề nghị chờ cùng lúc", async () => {
    const { id } = ok(
      await tasks.saveTask({
        title: `Việc gia hạn ${RUN}`,
        leadUserId: officer.id,
        dueDate: "15/11/2026",
        coDepartmentIds: [],
        coUserIds: [],
      } as never),
    );
    currentUser = officer;
    const early = await tasks.requestExtension({
      taskId: id,
      newDueDate: "10/11/2026",
      reason: "x",
    } as never);
    expect(!early.ok && early.error.fieldErrors?.newDueDate).toBe("Hạn mới phải sau hạn hiện tại.");
    const { extensionId } = ok(
      await tasks.requestExtension({
        taskId: id,
        newDueDate: "30/11/2026",
        reason: "Chờ số liệu",
      } as never),
    );
    const dup = await tasks.requestExtension({
      taskId: id,
      newDueDate: "05/12/2026",
      reason: "y",
    } as never);
    expect(!dup.ok && dup.error.code).toBe("PENDING_EXISTS");

    // Người thực hiện không tự duyệt được
    const self = await tasks.decideExtension({ extensionId, approve: true } as never);
    expect(!self.ok && self.error.code).toBe("FORBIDDEN");

    currentUser = clerk;
    ok(await tasks.decideExtension({ extensionId, approve: true, note: "Đồng ý" } as never));
    const task = await db.task.findUniqueOrThrow({ where: { id }, include: { extensions: true } });
    expect(task.dueDate?.toISOString().slice(0, 10)).toBe("2026-11-30");
    expect(task.extensions[0]).toMatchObject({
      status: "APPROVED",
      oldDueDate: new Date("2026-11-15T00:00:00Z"),
    });
  });

  it("OFFICER không giao việc được; không cập nhật việc của đơn vị khác", async () => {
    currentUser = officer;
    const r = await tasks.saveTask({
      title: "x",
      leadUserId: officer.id,
      coDepartmentIds: [],
      coUserIds: [],
    } as never);
    expect(!r.ok && r.error.code).toBe("FORBIDDEN");
    currentUser = clerk;
    const { id } = ok(
      await tasks.saveTask({
        title: `Việc đơn vị khác ${RUN}`,
        leadDepartmentId: depts[2],
        coDepartmentIds: [],
        coUserIds: [],
      } as never),
    );
    currentUser = officer;
    const u = await tasks.postTaskUpdate({ taskId: id, progress: 10, content: "thử" } as never);
    expect(!u.ok && u.error.code).toBe("FORBIDDEN");
  });
});
