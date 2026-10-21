"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import type { FieldConfig } from "@/components/common/EntityForm";
import { EntityFormDialog } from "@/components/common/EntityFormDialog";
import { FilePickList } from "@/components/common/FilePickList";
import { uploadMany } from "@/components/document-tree/upload";
import { vnDateKey } from "@/lib/format";
import { submissionSchema } from "@/lib/schemas/report";
import { submitReport, updateSubmission } from "@/server/actions/reports";

export type SubmitTarget = {
  periodId: string;
  title: string;
  dueDate: string;
  submission: { id: string; number: string | null; sentDate: string; note: string | null } | null;
};

const today = () => vnDateKey(new Date()).split("-").reverse().join("/");

/** Nộp báo cáo (QT-03): số/ký hiệu, ngày gửi, tệp; sửa được trong 24 giờ */
export function SubmitReportDialog({
  target,
  onClose,
}: {
  target: SubmitTarget;
  onClose: () => void;
}) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const editing = !!target.submission;
  const fields: FieldConfig[] = [
    { name: "number", label: "Số, ký hiệu báo cáo", placeholder: "VD: 15/BC-UBND" },
    {
      name: "sentDate",
      label: "Ngày gửi",
      type: "date",
      required: true,
      hint: `Hạn của kỳ: ${target.dueDate}. Gửi sau hạn sẽ ghi “Đã nộp trễ”.`,
    },
    { name: "note", label: "Ghi chú", type: "textarea" },
    {
      name: "files",
      label: editing ? "Bổ sung tệp báo cáo" : "Tệp báo cáo",
      type: "custom",
      wide: true,
      render: () => <FilePickList files={files} onChange={setFiles} />,
    },
  ];
  return (
    <EntityFormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={editing ? "Sửa báo cáo đã nộp" : "Nộp báo cáo"}
      description={target.title}
      fields={fields}
      schema={submissionSchema}
      defaultValues={{
        periodId: target.periodId,
        number: target.submission?.number ?? "",
        sentDate: target.submission?.sentDate ?? today(),
        note: target.submission?.note ?? "",
      }}
      submitLabel={editing ? "Lưu thay đổi" : "Nộp báo cáo"}
      successMessage={editing ? "Đã lưu báo cáo." : "Đã nộp báo cáo."}
      action={async (values) => {
        const r = editing
          ? await updateSubmission(values as never)
          : await submitReport(values as never);
        if (r.ok) {
          const childNote = (r.data as { childNote?: string | null }).childNote;
          if (childNote) toast.info(childNote, { duration: 8000 });
          if (files.length) {
            const uploads = await uploadMany({ submissionId: r.data.submissionId }, files);
            for (const u of uploads) if (!u.ok) toast.error(u.message, { duration: 10_000 });
          }
        }
        return r;
      }}
      onSuccess={() => {
        onClose();
        router.refresh();
      }}
    />
  );
}
