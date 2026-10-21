"use server";

import { randomUUID } from "node:crypto";

import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import { dateOnlyKey, vnDateKey } from "@/lib/format";
import { can } from "@/lib/permissions";
import { requirementSchema, submissionSchema } from "@/lib/schemas/report";
import { canAddChild, placementUnder } from "@/lib/tree";
import { withAuth } from "@/server/action";
import type { CurrentUser } from "@/server/auth/current-user";
import { documentResourceOf, getMaxTreeDepth } from "@/server/documents/queries";
import { AppError } from "@/server/errors";
import { notify, usersOfDepartments } from "@/server/notifications";
import { createMissingPeriods, regenerateFuturePeriods } from "@/server/reports/periods";
import { isSubmissionEditable } from "@/server/reports/queries";

type Tx = Prisma.TransactionClient;

const REVALIDATE: Array<string | [string, "layout"]> = [
  "/bao-cao",
  "/viec-cua-toi",
  ["/van-ban", "layout"],
  "/",
];

function ruleOf(input: z.output<typeof requirementSchema>) {
  return {
    name: input.name,
    frequency: input.frequency,
    onceDueDate: input.frequency === "ONCE" ? input.onceDueDate : null,
    dueDayOfPeriod: input.frequency === "ONCE" ? null : input.dueDayOfPeriod,
    dueMonthOffset: input.frequency === "ONCE" ? 0 : input.dueMonthOffset,
    startDate: input.startDate!,
    endDate: input.endDate,
    recipientAgencyId: input.recipientAgencyId,
    departmentIds: input.departmentIds,
    followerUserId: input.followerUserId,
    autoCreateChild: input.autoCreateChild,
    active: input.active,
  };
}

async function canCreateOn(user: CurrentUser, tx: Tx, documentId: string) {
  if (!can(user, "report.createRequirement")) return false;
  const doc = await tx.documentNode.findUnique({
    where: { id: documentId },
    include: {
      field: { select: { name: true } },
      shares: true,
      tasks: { where: { deletedAt: null } },
    },
  });
  return !!doc && !doc.deletedAt && can(user, "document.view", documentResourceOf(doc));
}

// ---------------------------------------------------------------- Yêu cầu báo cáo

export const saveRequirement = withAuth(
  {
    permission: async (user, input, tx) => {
      if (!input.id) return canCreateOn(user, tx, input.documentId);
      const req = await tx.reportRequirement.findUnique({
        where: { id: input.id },
        select: { documentId: true },
      });
      return !!req && canCreateOn(user, tx, req.documentId);
    },
    schema: requirementSchema,
    revalidate: REVALIDATE,
  },
  async ({ tx, user, input, audit }) => {
    const data = ruleOf(input);
    if (input.id) {
      const before = await tx.reportRequirement.findUniqueOrThrow({ where: { id: input.id } });
      const after = await tx.reportRequirement.update({ where: { id: input.id }, data });
      const { removed, created } = after.active
        ? await regenerateFuturePeriods(tx, after)
        : { removed: 0, created: 0 };
      audit({
        action: "UPDATE",
        entity: "ReportRequirement",
        entityId: after.id,
        before,
        after: { ...after, removed, created },
      });
      return { id: after.id, periods: created, removed };
    }
    const created = await tx.reportRequirement.create({
      data: { ...data, documentId: input.documentId },
    });
    const periods = await createMissingPeriods(tx, created);
    audit({
      action: "CREATE",
      entity: "ReportRequirement",
      entityId: created.id,
      after: { ...created, periods },
    });
    await notify(
      tx,
      await usersOfDepartments(tx, created.departmentIds),
      {
        kind: "REPORT_REQUIRED",
        title: `Đơn vị phải báo cáo: ${created.name}`,
        link: `/bao-cao?yeuCau=${created.id}`,
      },
      user.id,
    );
    return { id: created.id, periods, removed: 0 };
  },
);

// ---------------------------------------------------------------- Nộp báo cáo (QT-03)

async function loadPeriod(tx: Tx, periodId: string) {
  const period = await tx.reportPeriod.findUnique({
    where: { id: periodId },
    include: {
      department: true,
      submission: true,
      requirement: { include: { document: true } },
    },
  });
  if (!period) throw new AppError("NOT_FOUND", "Không tìm thấy kỳ báo cáo.");
  return period;
}

const reportLabel = (
  req: { name: string },
  period: { label: string },
  dept: { shortName: string | null; name: string },
) => `${req.name} — ${period.label} — ${dept.shortName ?? dept.name}`;

export const submitReport = withAuth(
  {
    permission: async (user, input, tx) =>
      can(user, "report.submit", {
        departmentId: (await loadPeriod(tx, input.periodId)).departmentId,
      }),
    schema: submissionSchema,
    revalidate: REVALIDATE,
  },
  async ({ tx, user, input, audit }) => {
    // Khoá kỳ để hai người không cùng nộp
    await tx.$queryRaw`SELECT "id" FROM "ReportPeriod" WHERE "id" = ${input.periodId} FOR UPDATE`;
    const period = await loadPeriod(tx, input.periodId);
    if (period.submission)
      throw new AppError(
        "ALREADY_SUBMITTED",
        "Kỳ báo cáo này đã được nộp — hãy sửa bản đã nộp nếu cần.",
      );
    const sentDate = input.sentDate!;
    if (dateOnlyKey(sentDate) > vnDateKey(new Date())) {
      const msg = "Ngày gửi không được sau ngày hôm nay.";
      throw new AppError("FUTURE_DATE", msg, { sentDate: msg });
    }

    // Tự thêm thành văn bản con của văn bản yêu cầu nếu cây còn chỗ (≤ 5 cấp); không thì chỉ lưu ở tab Báo cáo
    const doc = period.requirement.document;
    let linkedDocumentId: string | null = null;
    let childNote: string | null = null;
    if (period.requirement.autoCreateChild && !doc.deletedAt) {
      const maxDepth = await getMaxTreeDepth();
      const reportType = await tx.documentType.findFirst({ where: { code: "BC", active: true } });
      if (!canAddChild(doc.depth, maxDepth)) {
        childNote = `Văn bản yêu cầu đã ở cấp ${doc.depth} nên báo cáo chỉ lưu ở mục Báo cáo, không thêm vào cây.`;
      } else if (!reportType) {
        childNote = "Chưa có loại văn bản “Báo cáo” (mã BC) nên không thêm được vào cây.";
      } else {
        const id = randomUUID();
        const last = await tx.documentNode.aggregate({
          where: { parentId: doc.id },
          _max: { sortOrder: true },
        });
        await tx.documentNode.create({
          data: {
            id,
            ...placementUnder(doc, id),
            sortOrder: (last._max.sortOrder ?? 0) + 1,
            typeId: reportType.id,
            number: input.number,
            title: reportLabel(period.requirement, period, period.department),
            summary: input.note ? `<p>${input.note.replace(/[<>&]/g, " ")}</p>` : null,
            issuingAgencyText: period.department.name,
            issuedDate: sentDate,
            leadDepartmentId: period.departmentId,
            fieldId: doc.fieldId,
            isInternalPublic: doc.isInternalPublic,
            createdById: user.id,
          },
        });
        linkedDocumentId = id;
      }
    }

    const submission = await tx.reportSubmission.create({
      data: {
        periodId: period.id,
        number: input.number,
        sentDate,
        note: input.note,
        submittedById: user.id,
        linkedDocumentId,
      },
    });
    audit({
      action: "CREATE",
      entity: "ReportSubmission",
      entityId: submission.id,
      after: { ...submission, period: period.label, department: period.department.name },
    });
    await notify(
      tx,
      [period.requirement.followerUserId],
      {
        kind: "REPORT_SUBMITTED",
        title: `Đã nộp: ${reportLabel(period.requirement, period, period.department)}`,
        link: `/bao-cao?yeuCau=${period.requirementId}`,
      },
      user.id,
    );
    return { submissionId: submission.id, linkedDocumentId, childNote };
  },
);

export const updateSubmission = withAuth(
  {
    permission: async (user, input, tx) =>
      can(user, "report.submit", {
        departmentId: (await loadPeriod(tx, input.periodId)).departmentId,
      }),
    schema: submissionSchema,
    revalidate: REVALIDATE,
  },
  async ({ tx, user, input, audit }) => {
    const period = await loadPeriod(tx, input.periodId);
    const before = period.submission;
    if (!before) throw new AppError("NOT_SUBMITTED", "Kỳ báo cáo chưa được nộp.");
    if (!isSubmissionEditable(before) && !can(user, "report.unlock")) {
      throw new AppError(
        "LOCKED",
        "Bản nộp đã quá 24 giờ nên bị khoá. Liên hệ lãnh đạo hoặc quản trị để mở khoá.",
      );
    }
    const after = await tx.reportSubmission.update({
      where: { id: before.id },
      data: { number: input.number, sentDate: input.sentDate!, note: input.note },
    });
    if (after.linkedDocumentId) {
      await tx.documentNode.update({
        where: { id: after.linkedDocumentId },
        data: { number: input.number, issuedDate: input.sentDate!, updatedById: user.id },
      });
    }
    audit({ action: "UPDATE", entity: "ReportSubmission", entityId: before.id, before, after });
    return { submissionId: before.id };
  },
);

export const unlockSubmission = withAuth(
  {
    permission: "report.unlock",
    schema: z.object({ periodId: z.string().min(1) }),
    revalidate: REVALIDATE,
  },
  async ({ tx, input, audit }) => {
    const period = await loadPeriod(tx, input.periodId);
    if (!period.submission) throw new AppError("NOT_SUBMITTED", "Kỳ báo cáo chưa được nộp.");
    const unlockedAt = new Date();
    await tx.reportSubmission.update({ where: { id: period.submission.id }, data: { unlockedAt } });
    audit({
      action: "UNLOCK",
      entity: "ReportSubmission",
      entityId: period.submission.id,
      after: { unlockedAt },
    });
    return null;
  },
);
