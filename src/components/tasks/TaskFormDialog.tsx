"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { DocumentPicker, type PickedDocument } from "@/components/common/DocumentPicker";
import type { FieldConfig, Option } from "@/components/common/EntityForm";
import { EntityFormDialog } from "@/components/common/EntityFormDialog";
import { formatDate } from "@/lib/format";
import { PRIORITY_LABELS, taskSchema } from "@/lib/schemas/task";
import { saveTask } from "@/server/actions/tasks";

export type TaskFormOptions = { departments: Option[]; users: Option[] };

export type TaskEditValues = {
  id: string;
  title: string;
  description: string | null;
  document: { id: string; number: string | null; title: string } | null;
  leadDepartmentId: string | null;
  leadUserId: string | null;
  coDepartmentIds: string[];
  coUserIds: string[];
  startDate: Date | null;
  dueDate: Date | null;
  priority: keyof typeof PRIORITY_LABELS;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: TaskFormOptions;
  /** Giao việc từ văn bản (QT-02) */
  fromDocument?: { id: string; label: string } | null;
  task?: TaskEditValues;
};

const docLabel = (d: { number: string | null; title: string }) =>
  d.number ? `${d.number} – ${d.title}` : d.title;

export function TaskFormDialog({ open, onOpenChange, options, fromDocument, task }: Props) {
  const router = useRouter();
  const [doc, setDoc] = useState<PickedDocument | null>(
    task?.document
      ? {
          id: task.document.id,
          label: docLabel(task.document),
          depth: 0,
          path: "",
          isProgram: false,
        }
      : fromDocument
        ? { id: fromDocument.id, label: fromDocument.label, depth: 0, path: "", isProgram: false }
        : null,
  );

  const fields: FieldConfig[] = [
    { name: "title", label: "Tiêu đề công việc", required: true, wide: true },
    { name: "description", label: "Mô tả / yêu cầu", type: "textarea" },
    {
      name: "documentId",
      label: "Văn bản nguồn",
      type: "custom",
      wide: true,
      hint: "Không bắt buộc — có thể giao việc phát sinh không từ văn bản.",
      render: (p) => (
        <DocumentPicker
          id={p.id}
          value={doc}
          describedBy={p.describedBy}
          onChange={(d) => {
            setDoc(d);
            p.onChange(d?.id ?? "");
          }}
        />
      ),
    },
    {
      name: "leadDepartmentId",
      label: "Đơn vị chủ trì",
      type: "select",
      options: options.departments,
      hint: "Chọn đơn vị và/hoặc cá nhân chủ trì.",
    },
    { name: "leadUserId", label: "Cá nhân chủ trì", type: "select", options: options.users },
    {
      name: "coDepartmentIds",
      label: "Đơn vị phối hợp",
      type: "checkboxes",
      options: options.departments,
    },
    {
      name: "coUserIds",
      label: "Cá nhân phối hợp",
      type: "custom",
      wide: true,
      render: (p) => {
        const value = Array.isArray(p.value) ? (p.value as string[]) : [];
        return (
          <div
            id={p.id}
            role="group"
            aria-labelledby={p.labelId}
            className="grid max-h-48 grid-cols-1 gap-1 overflow-y-auto rounded-lg border p-2 sm:grid-cols-2"
          >
            {options.users.map((u) => (
              <label key={u.value} className="flex min-h-9 cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="size-5"
                  checked={value.includes(u.value)}
                  onChange={(e) =>
                    p.onChange(
                      e.target.checked ? [...value, u.value] : value.filter((v) => v !== u.value),
                    )
                  }
                />
                <span>{u.label}</span>
              </label>
            ))}
          </div>
        );
      },
    },
    { name: "startDate", label: "Ngày bắt đầu", type: "date" },
    { name: "dueDate", label: "Hạn hoàn thành", type: "date", hint: "Để trống nếu không có hạn." },
    {
      name: "priority",
      label: "Mức ưu tiên",
      type: "select",
      required: true,
      options: Object.entries(PRIORITY_LABELS).map(([value, label]) => ({ value, label })),
    },
  ];

  return (
    <EntityFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={task ? "Sửa công việc" : "Giao việc"}
      description={!task && doc ? `Từ văn bản: ${doc.label}` : undefined}
      fields={fields}
      schema={taskSchema}
      defaultValues={{
        id: task?.id ?? "",
        title: task?.title ?? "",
        description: task?.description ?? "",
        documentId: task?.document?.id ?? fromDocument?.id ?? "",
        leadDepartmentId: task?.leadDepartmentId ?? "",
        leadUserId: task?.leadUserId ?? "",
        coDepartmentIds: task?.coDepartmentIds ?? [],
        coUserIds: task?.coUserIds ?? [],
        startDate: task ? formatDate(task.startDate) : "",
        dueDate: task ? formatDate(task.dueDate) : "",
        priority: task?.priority ?? "NORMAL",
      }}
      submitLabel={task ? "Lưu thay đổi" : "Giao việc"}
      successMessage={task ? "Đã lưu công việc." : "Đã giao việc."}
      action={(values) => saveTask(values as never)}
      onSuccess={(data) => {
        if (task) router.refresh();
        else router.push(`/cong-viec/${data.id}`);
      }}
    />
  );
}
