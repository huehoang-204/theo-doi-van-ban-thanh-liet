import type { Metadata } from "next";
import { CircleAlert, CircleCheck, Clock } from "lucide-react";

import { TrashTable } from "@/components/admin/TrashTable";
import { PageHeader } from "@/components/common/PageHeader";
import { formatDateTime, vnDateKey } from "@/lib/format";
import { formatFileSize } from "@/lib/file-type";
import { vi } from "@/lib/i18n/vi";
import { vnMinutesOfDay } from "@/lib/reminders";
import { TRASH_RETENTION_DAYS } from "@/lib/trash";
import { requirePermission } from "@/server/auth/current-user";
import type { JobRecord } from "@/server/jobs/runner";
import { listTrash } from "@/server/trash/queries";

export const metadata: Metadata = { title: vi.nav.trash };

const fmtDay = (d: Date) => formatDateTime(d).split(" ")[0]!;

/** Tình trạng worker: lần chạy gần nhất của job; cảnh báo nếu hôm nay chưa chạy (worker có thể đang tắt) */
function JobStatus({
  label,
  record,
  expectedToday,
}: {
  label: string;
  record: JobRecord | null;
  expectedToday: boolean;
}) {
  const ranToday = record?.day === vnDateKey(new Date());
  const ok = record?.ok && (ranToday || !expectedToday);
  const Icon = !record ? Clock : ok ? CircleCheck : CircleAlert;
  return (
    <li className="flex items-start gap-2">
      <Icon
        className={`mt-0.5 size-5 shrink-0 ${ok ? "text-status-done" : record ? "text-status-due-soon" : "text-muted-foreground"}`}
        aria-hidden
      />
      <span>
        <strong>{label}</strong>:{" "}
        {!record
          ? "chưa chạy lần nào — kiểm tra tiến trình worker (npm run worker)."
          : !record.ok
            ? `lần chạy ${formatDateTime(new Date(record.at))} bị lỗi: ${record.error}`
            : `chạy gần nhất lúc ${formatDateTime(new Date(record.at))}${!ranToday && expectedToday ? " — hôm nay chưa chạy, kiểm tra tiến trình worker." : "."}`}
      </span>
    </li>
  );
}

/** Thùng rác (Mục 4.4): khôi phục hoặc xoá vĩnh viễn; job đêm tự xoá mục quá 30 ngày */
export default async function TrashPage() {
  await requirePermission("trash.manage");
  const { documents, attachments, jobs } = await listTrash();
  return (
    <>
      <PageHeader
        title={vi.nav.trash}
        description={`Văn bản và tệp đã xoá được giữ ${TRASH_RETENTION_DAYS} ngày, sau đó hệ thống tự xoá vĩnh viễn (00:15 hằng đêm). Khôi phục văn bản sẽ khôi phục cả nhánh đã xoá cùng lúc.`}
      />
      <section
        aria-label="Tình trạng xử lý tự động"
        className="mb-4 rounded-xl border bg-card p-4 text-muted-foreground"
      >
        <ul className="grid gap-2 lg:grid-cols-2">
          <JobStatus
            label="Nhắc hạn 06:30"
            record={jobs.daily}
            expectedToday={vnMinutesOfDay(new Date()) >= 7 * 60}
          />
          <JobStatus
            label="Tính lại tiến độ & dọn Thùng rác (00:15)"
            record={jobs.nightly}
            expectedToday
          />
        </ul>
      </section>
      <TrashTable
        documents={documents.map((d) => ({
          id: d.id,
          number: d.number,
          title: d.title,
          typeName: d.typeName,
          typeColor: d.typeColor,
          trail: d.trail,
          branchCount: d.branchCount,
          attachmentCount: d.attachmentCount,
          requirementCount: d.requirementCount,
          deletedAt: formatDateTime(d.deletedAt),
          deletedBy: d.deletedBy,
          purgeOn: fmtDay(d.purgeAt),
          daysLeft: d.daysLeft,
          parentDeleted: d.parentDeleted,
        }))}
        attachments={attachments.map((a) => ({
          id: a.id,
          fileName: a.fileName,
          size: formatFileSize(a.sizeBytes),
          documentId: a.documentId,
          documentLabel: a.documentLabel,
          deletedAt: formatDateTime(a.deletedAt),
          deletedBy: a.deletedBy,
          purgeOn: fmtDay(a.purgeAt),
          daysLeft: a.daysLeft,
        }))}
      />
    </>
  );
}
