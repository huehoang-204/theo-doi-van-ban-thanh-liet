import "server-only";

import type { PeriodRow } from "@/components/reports/PeriodsTable";
import { dateOnlyKey, formatDate } from "@/lib/format";
import type { PeriodItem } from "@/server/reports/queries";

/** Kỳ báo cáo → dòng bảng (dữ liệu tuần tự hoá được cho client) */
export function toPeriodRow(p: PeriodItem): PeriodRow {
  return {
    id: p.id,
    label: p.label,
    dueDate: formatDate(p.dueDate),
    dueSort: p.dueDate.toISOString(),
    daysLeft: p.daysLeft,
    status: p.status,
    requirement: {
      id: p.requirement.id,
      name: p.requirement.name,
      recipient: p.requirement.recipientAgency?.name ?? null,
    },
    document: {
      id: p.requirement.document.id,
      number: p.requirement.document.number,
      title: p.requirement.document.title,
    },
    department: p.department,
    submission: p.submission && {
      id: p.submission.id,
      number: p.submission.number,
      sentDate: formatDate(p.submission.sentDate),
      note: p.submission.note,
      submittedBy: p.submission.submittedBy.fullName,
      linkedDocumentId: p.submission.linkedDocument?.id ?? null,
      attachments: p.submission.attachments.map((a) => ({ id: a.id, fileName: a.fileName })),
    },
    canSubmit: p.canSubmit,
    editable: p.editable,
    upcoming: p.daysLeft <= 60,
    dueMonth: dateOnlyKey(p.dueDate).slice(0, 7),
  };
}
