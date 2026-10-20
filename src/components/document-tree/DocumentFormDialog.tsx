"use client";

import { FileUp, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { toast } from "sonner";

import { DocumentPicker, type PickedDocument } from "@/components/common/DocumentPicker";
import type { FieldConfig, FormValues } from "@/components/common/EntityForm";
import { EntityFormDialog } from "@/components/common/EntityFormDialog";
import { RichTextEditor } from "@/components/common/RichTextEditor";
import { Button } from "@/components/ui/button";
import { ACCEPT_ATTRIBUTE, formatFileSize } from "@/lib/file-type";
import { formatDate, vnDateKey } from "@/lib/format";
import { documentFormSchema, URGENCY_LABELS, VALIDITY_LABELS } from "@/lib/schemas/document";
import { createDocument, updateDocument } from "@/server/actions/documents";

import { SecretWarning } from "./SecretWarning";
import { useTree } from "./TreeContext";
import type { NodeRef } from "./types";
import { uploadMany } from "./upload";

/** Giá trị hiện có của văn bản khi sửa */
export type DocumentEditValues = {
  id: string;
  parentId: string | null;
  depth: number;
  typeId: string;
  number: string | null;
  title: string;
  issuingAgencyId: string | null;
  issuingAgencyText: string | null;
  signer: string | null;
  issuedDate: Date | null;
  effectiveDate: Date | null;
  dueDate: Date | null;
  fieldId: string | null;
  urgency: keyof typeof URGENCY_LABELS;
  validity: keyof typeof VALIDITY_LABELS;
  replacedBy: { id: string; number: string | null; title: string } | null;
  leadDepartmentId: string | null;
  coDepartmentIds: string[];
  summary: string | null;
  tags: string[];
  isInternalPublic: boolean;
};

type Props =
  | { mode: "create"; parent: NodeRef | null; open: boolean; onOpenChange: (open: boolean) => void }
  | { mode: "edit"; doc: DocumentEditValues; open: boolean; onOpenChange: (open: boolean) => void };

const todayText = () => vnDateKey(new Date()).split("-").reverse().join("/");

export function DocumentFormDialog(props: Props) {
  const tree = useTree();
  const router = useRouter();
  const fileInputId = useId();
  const [files, setFiles] = useState<File[]>([]);
  const isEdit = props.mode === "edit";
  const parent = props.mode === "create" ? props.parent : null;
  const depth = isEdit ? props.doc.depth : (parent?.depth ?? 0) + 1;
  const [replaced, setReplaced] = useState<PickedDocument | null>(
    isEdit && props.doc.replacedBy
      ? {
          id: props.doc.replacedBy.id,
          label: props.doc.replacedBy.number ?? props.doc.replacedBy.title,
          depth: 0,
          path: "",
          isProgram: false,
        }
      : null,
  );

  // Cấp 1 bắt buộc loại "Chương trình"
  const typeOptions = tree.options.types
    .filter((t) => depth > 1 || t.isProgram)
    .map((t) => ({ value: t.id, label: `${t.name} (${t.code})` }));

  const fields: FieldConfig[] = [
    {
      name: "typeId",
      label: "Loại văn bản",
      type: "select",
      required: true,
      options: typeOptions,
      emptyOption: "— Chọn loại —",
    },
    {
      name: "number",
      label: "Số, ký hiệu",
      placeholder: "VD: 45/KH-UBND",
      hint: "Chương trình nội bộ có thể không có số.",
    },
    {
      name: "title",
      label: "Trích yếu / Tiêu đề",
      type: "textarea",
      required: true,
      hint: "Tối đa 500 ký tự.",
    },
    {
      name: "issuingAgencyId",
      label: "Cơ quan ban hành",
      type: "select",
      required: true,
      options: tree.options.agencies,
      emptyOption: "— Cơ quan khác (nhập tên bên dưới) —",
    },
    {
      name: "issuingAgencyText",
      label: "Tên cơ quan ban hành (nếu không có trong danh sách)",
      visibleWhen: (v) => !v.issuingAgencyId,
    },
    { name: "signer", label: "Người ký" },
    { name: "issuedDate", label: "Ngày ban hành", type: "date", required: true },
    { name: "effectiveDate", label: "Ngày hiệu lực", type: "date" },
    { name: "dueDate", label: "Hạn xử lý chung", type: "date" },
    { name: "fieldId", label: "Lĩnh vực", type: "select", options: tree.options.fields },
    {
      name: "urgency",
      label: "Độ khẩn",
      type: "select",
      required: true,
      options: Object.entries(URGENCY_LABELS).map(([value, label]) => ({ value, label })),
    },
    {
      name: "leadDepartmentId",
      label: "Đơn vị chủ trì",
      type: "select",
      options: tree.options.departments,
    },
    {
      name: "coDepartmentIds",
      label: "Đơn vị phối hợp",
      type: "checkboxes",
      options: tree.options.departments,
    },
    {
      name: "summary",
      label: "Nội dung tóm tắt",
      type: "custom",
      wide: true,
      render: (p) => (
        <RichTextEditor
          id={p.id}
          value={typeof p.value === "string" ? p.value : ""}
          onChange={p.onChange}
          onBlur={p.onBlur}
          invalid={p.invalid}
          describedBy={p.describedBy}
          labelledBy={p.labelId}
        />
      ),
    },
    {
      name: "tags",
      label: "Từ khoá / Thẻ",
      wide: true,
      placeholder: "VD: chuyển đổi số, TTHC",
      hint: "Phân cách các thẻ bằng dấu phẩy.",
    },
    {
      name: "validity",
      label: "Trạng thái văn bản",
      type: "select",
      required: true,
      options: Object.entries(VALIDITY_LABELS).map(([value, label]) => ({ value, label })),
    },
    {
      name: "replacedById",
      label: "Văn bản thay thế",
      type: "custom",
      required: true,
      visibleWhen: (v) => v.validity === "REPLACED",
      render: (p) => (
        <DocumentPicker
          id={p.id}
          value={replaced}
          describedBy={p.describedBy}
          exclude={(h) => isEdit && h.id === props.doc.id}
          onChange={(doc) => {
            setReplaced(doc);
            p.onChange(doc?.id ?? "");
            p.onBlur();
          }}
        />
      ),
    },
    {
      name: "isInternalPublic",
      label: "Phạm vi xem",
      type: "checkbox",
      placeholder: "Công khai nội bộ (mọi cán bộ đều xem được)",
      hint: "Không chọn: cán bộ chỉ xem được khi đơn vị mình chủ trì/phối hợp hoặc có việc được giao.",
    },
  ];

  if (!isEdit) {
    fields.push({
      name: "files",
      label: "Tệp đính kèm",
      type: "custom",
      wide: true,
      hint: "PDF, DOC, DOCX, XLS, XLSX, JPG, PNG — tối đa 20 MB mỗi tệp.",
      render: () => (
        <div className="flex flex-col gap-2">
          <SecretWarning />
          <label
            htmlFor={fileInputId}
            className="flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-input bg-card px-4 py-2 font-medium hover:bg-brand-soft"
          >
            <FileUp className="size-5" aria-hidden />
            Chọn tệp…
          </label>
          <input
            id={fileInputId}
            type="file"
            multiple
            accept={ACCEPT_ATTRIBUTE}
            className="sr-only"
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []);
              setFiles((prev) => [...prev, ...picked]);
              e.target.value = "";
            }}
          />
          {files.length > 0 && (
            <ul className="flex flex-col gap-1">
              {files.map((f, i) => (
                <li
                  key={`${f.name}-${i}`}
                  className="flex items-center gap-2 rounded-md bg-muted px-3 py-1.5"
                >
                  <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  <span className="text-sm text-muted-foreground">{formatFileSize(f.size)}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setFiles(files.filter((_, j) => j !== i))}
                    aria-label={`Bỏ tệp ${f.name}`}
                  >
                    <X aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ),
    });
  }

  const s = (v: string | null | undefined) => v ?? "";
  const defaults: FormValues = isEdit
    ? {
        id: props.doc.id,
        typeId: props.doc.typeId,
        number: s(props.doc.number),
        title: props.doc.title,
        issuingAgencyId: s(props.doc.issuingAgencyId),
        issuingAgencyText: s(props.doc.issuingAgencyText),
        signer: s(props.doc.signer),
        issuedDate: formatDate(props.doc.issuedDate),
        effectiveDate: formatDate(props.doc.effectiveDate),
        dueDate: formatDate(props.doc.dueDate),
        fieldId: s(props.doc.fieldId),
        urgency: props.doc.urgency,
        validity: props.doc.validity,
        replacedById: s(props.doc.replacedBy?.id),
        leadDepartmentId: s(props.doc.leadDepartmentId),
        coDepartmentIds: props.doc.coDepartmentIds,
        summary: s(props.doc.summary),
        tags: props.doc.tags.join(", "),
        isInternalPublic: props.doc.isInternalPublic,
      }
    : {
        parentId: parent?.id ?? "",
        typeId: depth === 1 ? (tree.options.types.find((t) => t.isProgram)?.id ?? "") : "",
        number: "",
        title: "",
        issuingAgencyId: "",
        issuingAgencyText: "",
        signer: "",
        issuedDate: todayText(),
        effectiveDate: "",
        dueDate: "",
        fieldId: "",
        urgency: "NORMAL",
        validity: "ACTIVE",
        replacedById: "",
        leadDepartmentId: "",
        coDepartmentIds: [],
        summary: "",
        tags: "",
        isInternalPublic: depth <= 2,
      };

  const title = isEdit
    ? "Sửa văn bản"
    : parent
      ? `Thêm văn bản con (cấp ${depth}) vào “${parent.label}”`
      : "Thêm chương trình (cấp 1)";

  return (
    <EntityFormDialog
      open={props.open}
      onOpenChange={(o) => {
        if (!o) setFiles([]);
        props.onOpenChange(o);
      }}
      title={title}
      description={
        isEdit
          ? undefined
          : "Thông tin theo thể thức văn bản (Nghị định 30/2020/NĐ-CP). Ô có dấu * là bắt buộc."
      }
      fields={fields}
      schema={documentFormSchema}
      defaultValues={defaults}
      submitLabel={isEdit ? "Lưu thay đổi" : "Thêm văn bản"}
      successMessage={isEdit ? "Đã lưu văn bản." : "Đã thêm văn bản."}
      action={async (values) => {
        const result = isEdit
          ? await updateDocument({ ...values, id: props.doc.id } as never)
          : await createDocument(values as never);
        if (result.ok && !isEdit && files.length > 0) {
          const uploads = await uploadMany(result.data.id, files);
          for (const u of uploads) if (!u.ok) toast.error(u.message, { duration: 10_000 });
          const done = uploads.filter((u) => u.ok).length;
          if (done > 0) toast.success(`Đã tải lên ${done} tệp.`);
        }
        return result;
      }}
      onSuccess={async (data) => {
        setFiles([]);
        await tree.refresh([data.parentId]);
        if (data.parentId && !tree.expanded.has(data.parentId)) tree.toggle(data.parentId);
        if (isEdit) router.refresh();
        else router.push(`/van-ban/${data.id}`);
      }}
    />
  );
}
