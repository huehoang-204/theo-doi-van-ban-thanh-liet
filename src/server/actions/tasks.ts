"use server";

import type { Prisma } from "@/generated/prisma/client";
import { can } from "@/lib/permissions";
import { checkTransition, type TaskEvent } from "@/lib/status";
import {
  approveTaskSchema,
  cancelTaskSchema,
  extensionDecisionSchema,
  extensionRequestSchema,
  progressUpdateSchema,
  returnTaskSchema,
  submitTaskSchema,
  taskSchema,
} from "@/lib/schemas/task";
import { withAuth } from "@/server/action";
import type { CurrentUser } from "@/server/auth/current-user";
import { recomputeTrees, rootsOf } from "@/server/documents/progress";
import { documentResourceOf } from "@/server/documents/queries";
import { AppError } from "@/server/errors";
import { notify, usersOfDepartments } from "@/server/notifications";
import { taskResourceOf } from "@/server/tasks/queries";

type Tx = Prisma.TransactionClient;

// Tiến độ trên cây văn bản, Việc của tôi, danh sách công việc/báo cáo đều đổi theo
const REVALIDATE: Array<string | [string, "layout"]> = [
  ["/cong-viec", "layout"],
  "/viec-cua-toi",
  ["/van-ban", "layout"],
  "/",
];

async function loadTask(tx: Tx, id: string) {
  const task = await tx.task.findFirst({ where: { id, deletedAt: null } });
  if (!task) throw new AppError("NOT_FOUND", "Không tìm thấy công việc — có thể đã bị xoá.");
  return task;
}

function ensure(flow: Parameters<typeof checkTransition>[0], event: TaskEvent) {
  const error = checkTransition(flow, event);
  if (error) throw new AppError("INVALID_FLOW", error);
}

/** Người thực hiện cần biết: chủ trì (cá nhân hoặc cả đơn vị nếu không giao cá nhân) + phối hợp */
async function doers(
  tx: Tx,
  t: { leadUserId: string | null; leadDepartmentId: string | null; coUserIds: string[] },
) {
  const deptUsers = t.leadUserId ? [] : await usersOfDepartments(tx, [t.leadDepartmentId]);
  return [t.leadUserId, ...t.coUserIds, ...deptUsers];
}

const canUpdate = async (user: CurrentUser, tx: Tx, taskId: string) =>
  can(user, "task.updateProgress", taskResourceOf(await loadTask(tx, taskId)));
const canApprove = async (user: CurrentUser, tx: Tx, taskId: string) =>
  can(user, "task.approve", taskResourceOf(await loadTask(tx, taskId)));

async function refreshTree(tx: Tx, ...documentIds: (string | null)[]) {
  await recomputeTrees(tx, await rootsOf(tx, documentIds));
}

// ---------------------------------------------------------------- Giao việc / sửa

export const saveTask = withAuth(
  {
    permission: async (user, input, tx) => {
      if (!input.id) {
        if (!can(user, "task.assign")) return false;
        // Giao việc từ văn bản: phải xem được văn bản đó
        if (input.documentId) {
          const doc = await tx.documentNode.findUnique({
            where: { id: input.documentId },
            include: {
              field: { select: { name: true } },
              shares: true,
              tasks: { where: { deletedAt: null } },
            },
          });
          return !!doc && !doc.deletedAt && can(user, "document.view", documentResourceOf(doc));
        }
        return true;
      }
      return canApprove(user, tx, input.id); // sửa: người giao / lãnh đạo / quản trị
    },
    schema: taskSchema,
    revalidate: REVALIDATE,
  },
  async ({ tx, user, input: { id, ...data }, audit }) => {
    if (id) {
      const before = await loadTask(tx, id);
      ensure(before.flow, "EDIT");
      const after = await tx.task.update({ where: { id }, data });
      await tx.taskUpdate.create({
        data: {
          taskId: id,
          userId: user.id,
          kind: "EDIT",
          progress: after.progress,
          content: "Cập nhật thông tin công việc.",
        },
      });
      audit({ action: "UPDATE", entity: "Task", entityId: id, before, after });
      await refreshTree(tx, before.documentId, after.documentId);
      return { id };
    }
    const created = await tx.task.create({ data: { ...data, assignerId: user.id } });
    await tx.taskUpdate.create({
      data: {
        taskId: created.id,
        userId: user.id,
        kind: "ASSIGN",
        progress: 0,
        content: "Giao việc.",
      },
    });
    audit({ action: "CREATE", entity: "Task", entityId: created.id, after: created });
    await notify(
      tx,
      await doers(tx, created),
      {
        kind: "TASK_ASSIGNED",
        title: `Bạn được giao việc: ${created.title}`,
        link: `/cong-viec/${created.id}`,
      },
      user.id,
    );
    await refreshTree(tx, created.documentId);
    return { id: created.id };
  },
);

// ---------------------------------------------------------------- Cập nhật tiến độ

export const postTaskUpdate = withAuth(
  {
    permission: (user, input, tx) => canUpdate(user, tx, input.taskId),
    schema: progressUpdateSchema,
    revalidate: REVALIDATE,
  },
  async ({ tx, user, input, audit }) => {
    const task = await loadTask(tx, input.taskId);
    ensure(task.flow, "UPDATE_PROGRESS");
    const update = await tx.taskUpdate.create({
      data: {
        taskId: task.id,
        userId: user.id,
        kind: "PROGRESS",
        progress: input.progress,
        content: input.content,
      },
    });
    await tx.task.update({
      where: { id: task.id },
      data: { progress: input.progress, flow: "IN_PROGRESS" },
    });
    audit({
      action: "UPDATE",
      entity: "Task",
      entityId: task.id,
      before: { progress: task.progress, flow: task.flow },
      after: { progress: input.progress, updateId: update.id },
    });
    await refreshTree(tx, task.documentId);
    return { updateId: update.id };
  },
);

// ---------------------------------------------------------------- Báo hoàn thành → duyệt / trả lại

export const submitTask = withAuth(
  {
    permission: (user, input, tx) => canUpdate(user, tx, input.taskId),
    schema: submitTaskSchema,
    revalidate: REVALIDATE,
  },
  async ({ tx, user, input, audit }) => {
    const task = await loadTask(tx, input.taskId);
    ensure(task.flow, "SUBMIT");
    const now = new Date();
    const update = await tx.taskUpdate.create({
      data: {
        taskId: task.id,
        userId: user.id,
        kind: "SUBMIT",
        progress: 100,
        content: input.content,
      },
    });
    await tx.task.update({
      where: { id: task.id },
      data: { flow: "SUBMITTED", progress: 100, submittedAt: now },
    });
    audit({
      action: "UPDATE",
      entity: "Task",
      entityId: task.id,
      before: { flow: task.flow },
      after: { flow: "SUBMITTED", submittedAt: now },
    });
    await notify(
      tx,
      [task.assignerId],
      {
        kind: "TASK_SUBMITTED",
        title: `Báo hoàn thành, chờ duyệt: ${task.title}`,
        link: `/cong-viec/${task.id}`,
      },
      user.id,
    );
    await refreshTree(tx, task.documentId);
    return { updateId: update.id };
  },
);

export const approveTask = withAuth(
  {
    permission: (user, input, tx) => canApprove(user, tx, input.taskId),
    schema: approveTaskSchema,
    revalidate: REVALIDATE,
  },
  async ({ tx, user, input, audit }) => {
    const task = await loadTask(tx, input.taskId);
    ensure(task.flow, "APPROVE");
    // D3: hoàn thành tính tại lúc báo hoàn thành (không phạt người làm vì duyệt chậm)
    const completedAt = task.submittedAt ?? new Date();
    await tx.task.update({
      where: { id: task.id },
      data: { flow: "DONE", progress: 100, completedAt },
    });
    await tx.taskUpdate.create({
      data: {
        taskId: task.id,
        userId: user.id,
        kind: "APPROVE",
        progress: 100,
        content: input.note ?? "Đồng ý kết quả, đóng công việc.",
      },
    });
    audit({
      action: "UPDATE",
      entity: "Task",
      entityId: task.id,
      before: { flow: task.flow },
      after: { flow: "DONE", completedAt },
    });
    await notify(
      tx,
      await doers(tx, task),
      {
        kind: "TASK_APPROVED",
        title: `Công việc đã được duyệt hoàn thành: ${task.title}`,
        link: `/cong-viec/${task.id}`,
      },
      user.id,
    );
    await refreshTree(tx, task.documentId);
    return null;
  },
);

export const returnTask = withAuth(
  {
    permission: (user, input, tx) => canApprove(user, tx, input.taskId),
    schema: returnTaskSchema,
    revalidate: REVALIDATE,
  },
  async ({ tx, user, input, audit }) => {
    const task = await loadTask(tx, input.taskId);
    ensure(task.flow, "RETURN");
    // Trả lại: về "đang thực hiện", giữ tiến độ trước lần báo hoàn thành
    const lastProgress = await tx.taskUpdate.findFirst({
      where: { taskId: task.id, kind: "PROGRESS" },
      orderBy: { createdAt: "desc" },
      select: { progress: true },
    });
    const progress = Math.min(lastProgress?.progress ?? 90, 90);
    await tx.task.update({
      where: { id: task.id },
      data: { flow: "IN_PROGRESS", submittedAt: null, progress },
    });
    await tx.taskUpdate.create({
      data: { taskId: task.id, userId: user.id, kind: "RETURN", progress, content: input.note },
    });
    audit({
      action: "UPDATE",
      entity: "Task",
      entityId: task.id,
      before: { flow: task.flow },
      after: { flow: "IN_PROGRESS", returned: input.note },
    });
    await notify(
      tx,
      await doers(tx, task),
      {
        kind: "TASK_RETURNED",
        title: `Công việc bị trả lại: ${task.title}`,
        link: `/cong-viec/${task.id}`,
      },
      user.id,
    );
    await refreshTree(tx, task.documentId);
    return null;
  },
);

export const cancelTask = withAuth(
  {
    permission: (user, input, tx) => canApprove(user, tx, input.taskId),
    schema: cancelTaskSchema,
    revalidate: REVALIDATE,
  },
  async ({ tx, user, input, audit }) => {
    const task = await loadTask(tx, input.taskId);
    ensure(task.flow, "CANCEL");
    await tx.task.update({ where: { id: task.id }, data: { flow: "CANCELLED" } });
    await tx.taskExtension.updateMany({
      where: { taskId: task.id, status: "PENDING" },
      data: {
        status: "REJECTED",
        decidedById: user.id,
        decidedAt: new Date(),
        decisionNote: "Công việc đã huỷ.",
      },
    });
    await tx.taskUpdate.create({
      data: {
        taskId: task.id,
        userId: user.id,
        kind: "CANCEL",
        progress: task.progress,
        content: input.note,
      },
    });
    audit({
      action: "UPDATE",
      entity: "Task",
      entityId: task.id,
      before: { flow: task.flow },
      after: { flow: "CANCELLED", reason: input.note },
    });
    await notify(
      tx,
      await doers(tx, task),
      {
        kind: "TASK_CANCELLED",
        title: `Công việc đã bị huỷ: ${task.title}`,
        link: `/cong-viec/${task.id}`,
      },
      user.id,
    );
    await refreshTree(tx, task.documentId);
    return null;
  },
);

// ---------------------------------------------------------------- Gia hạn

export const requestExtension = withAuth(
  {
    permission: (user, input, tx) => canUpdate(user, tx, input.taskId),
    schema: extensionRequestSchema,
    revalidate: REVALIDATE,
  },
  async ({ tx, user, input, audit }) => {
    const task = await loadTask(tx, input.taskId);
    ensure(task.flow, "REQUEST_EXTENSION");
    if (!task.dueDate)
      throw new AppError("NO_DUE", "Công việc không đặt hạn nên không cần gia hạn.");
    const newDueDate = input.newDueDate!;
    if (newDueDate <= task.dueDate) {
      const msg = "Hạn mới phải sau hạn hiện tại.";
      throw new AppError("INVALID_DUE", msg, { newDueDate: msg });
    }
    if (await tx.taskExtension.findFirst({ where: { taskId: task.id, status: "PENDING" } })) {
      throw new AppError(
        "PENDING_EXISTS",
        "Đang có một đề nghị gia hạn chờ duyệt cho công việc này.",
      );
    }
    const ext = await tx.taskExtension.create({
      data: {
        taskId: task.id,
        requestedById: user.id,
        oldDueDate: task.dueDate,
        newDueDate,
        reason: input.reason,
      },
    });
    await tx.taskUpdate.create({
      data: {
        taskId: task.id,
        userId: user.id,
        kind: "EXTENSION_REQUEST",
        progress: task.progress,
        content: input.reason,
      },
    });
    audit({ action: "CREATE", entity: "TaskExtension", entityId: ext.id, after: ext });
    // "Đề nghị gia hạn (gửi lãnh đạo)" — người giao việc là người duyệt
    await notify(
      tx,
      [task.assignerId],
      {
        kind: "EXTENSION_REQUEST",
        title: `Đề nghị gia hạn: ${task.title}`,
        link: `/cong-viec/${task.id}`,
      },
      user.id,
    );
    return { extensionId: ext.id };
  },
);

export const decideExtension = withAuth(
  {
    permission: async (user, input, tx) => {
      const ext = await tx.taskExtension.findUnique({
        where: { id: input.extensionId },
        select: { taskId: true },
      });
      return !!ext && canApprove(user, tx, ext.taskId);
    },
    schema: extensionDecisionSchema,
    revalidate: REVALIDATE,
  },
  async ({ tx, user, input, audit }) => {
    const ext = await tx.taskExtension.findUniqueOrThrow({ where: { id: input.extensionId } });
    if (ext.status !== "PENDING")
      throw new AppError("DECIDED", "Đề nghị gia hạn này đã được xử lý.");
    const task = await loadTask(tx, ext.taskId);
    const decided = await tx.taskExtension.update({
      where: { id: ext.id },
      data: {
        status: input.approve ? "APPROVED" : "REJECTED",
        decidedById: user.id,
        decidedAt: new Date(),
        decisionNote: input.note,
      },
    });
    if (input.approve)
      await tx.task.update({ where: { id: task.id }, data: { dueDate: ext.newDueDate } });
    await tx.taskUpdate.create({
      data: {
        taskId: task.id,
        userId: user.id,
        kind: "EXTENSION_DECISION",
        progress: task.progress,
        content: `${input.approve ? "Đồng ý" : "Không đồng ý"} gia hạn${input.note ? `: ${input.note}` : "."}`,
      },
    });
    audit({
      action: "UPDATE",
      entity: "TaskExtension",
      entityId: ext.id,
      before: ext,
      after: decided,
    });
    await notify(
      tx,
      [ext.requestedById],
      {
        kind: "EXTENSION_DECIDED",
        title: `${input.approve ? "Đã đồng ý" : "Không đồng ý"} gia hạn: ${task.title}`,
        link: `/cong-viec/${task.id}`,
      },
      user.id,
    );
    await refreshTree(tx, task.documentId);
    return null;
  },
);
