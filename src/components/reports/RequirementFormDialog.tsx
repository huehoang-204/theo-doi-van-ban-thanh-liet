"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { FieldConfig, FormValues, Option } from "@/components/common/EntityForm";
import { EntityFormDialog } from "@/components/common/EntityFormDialog";
import { formatDate, formatNumber } from "@/lib/format";
import { countPeriods, describeRule, generatePeriods } from "@/lib/report-periods";
import { parseViDate, toNumber } from "@/lib/schemas/common";
import { FREQUENCY_LABELS, requirementSchema } from "@/lib/schemas/report";
import { saveRequirement } from "@/server/actions/reports";

export type RequirementEditValues = {
  id: string;
  name: string;
  frequency: keyof typeof FREQUENCY_LABELS;
  onceDueDate: Date | null;
  dueDayOfPeriod: number | null;
  dueMonthOffset: number | null;
  startDate: Date;
  endDate: Date | null;
  recipientAgencyId: string | null;
  departmentIds: string[];
  followerUserId: string | null;
  autoCreateChild: boolean;
  active: boolean;
};

export type RequirementOptions = { departments: Option[]; agencies: Option[]; users: Option[] };

/** Xem trước số kỳ sẽ sinh ngay trên form (dùng chung hàm sinh kỳ với máy chủ) */
function Preview({ values }: { values: FormValues }) {
  const start = typeof values.startDate === "string" ? parseViDate(values.startDate) : null;
  const end =
    typeof values.endDate === "string" && values.endDate ? parseViDate(values.endDate) : null;
  const once = typeof values.onceDueDate === "string" ? parseViDate(values.onceDueDate) : null;
  const depts = Array.isArray(values.departmentIds) ? values.departmentIds.length : 0;
  const frequency = values.frequency as keyof typeof FREQUENCY_LABELS;
  if (!start || !frequency || depts === 0)
    return (
      <p className="text-muted-foreground">
        Nhập kiểu, thời gian áp dụng và đơn vị để xem trước số kỳ.
      </p>
    );
  const rule = {
    frequency,
    onceDueDate: once,
    dueDayOfPeriod: toNumber(values.dueDayOfPeriod) ?? null,
    dueMonthOffset: toNumber(values.dueMonthOffset) ?? 0,
    startDate: start,
    endDate: end,
  };
  const periods = generatePeriods(rule);
  if (periods.length === 0)
    return <p className="text-destructive">Với thông tin hiện tại sẽ không sinh kỳ báo cáo nào.</p>;
  return (
    <p role="status" className="rounded-lg bg-brand-soft/60 px-3 py-2">
      {describeRule(rule)} · sẽ sinh <strong>{formatNumber(countPeriods(rule, depts))} kỳ</strong> (
      {periods.length} kỳ × {depts} đơn vị), từ {periods[0]!.label} (hạn{" "}
      {formatDate(periods[0]!.dueDate)}) đến {periods.at(-1)!.label}
      {!end && " — chưa đặt ngày kết thúc: hệ thống tự sinh thêm khi gần hết"}.
    </p>
  );
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  options: RequirementOptions;
  requirement?: RequirementEditValues;
};

export function RequirementFormDialog({
  open,
  onOpenChange,
  documentId,
  options,
  requirement,
}: Props) {
  const router = useRouter();
  const fields: FieldConfig[] = [
    {
      name: "name",
      label: "Tên báo cáo",
      required: true,
      wide: true,
      placeholder: "VD: Báo cáo kết quả thực hiện chuyển đổi số",
    },
    {
      name: "frequency",
      label: "Kiểu báo cáo",
      type: "select",
      required: true,
      options: Object.entries(FREQUENCY_LABELS).map(([value, label]) => ({ value, label })),
    },
    {
      name: "onceDueDate",
      label: "Hạn nộp",
      type: "date",
      required: true,
      visibleWhen: (v) => v.frequency === "ONCE",
    },
    {
      name: "dueDayOfPeriod",
      label: "Ngày hạn trong kỳ",
      type: "number",
      required: true,
      visibleWhen: (v) => v.frequency !== "ONCE",
      hint: "VD 20 = ngày 20 hằng tháng; với báo cáo quý/6 tháng/năm là ngày trong tháng cuối kỳ. Ngày lớn hơn số ngày của tháng → ngày cuối tháng.",
    },
    {
      name: "dueMonthOffset",
      label: "Hạn rơi vào",
      type: "select",
      required: true,
      visibleWhen: (v) => v.frequency !== "ONCE",
      options: [
        { value: "0", label: "Tháng cuối của kỳ" },
        { value: "1", label: "Tháng sau kỳ (VD ngày 5 tháng sau)" },
      ],
    },
    { name: "startDate", label: "Áp dụng từ ngày", type: "date", required: true },
    { name: "endDate", label: "Đến ngày", type: "date", hint: "Để trống nếu áp dụng lâu dài." },
    {
      name: "recipientAgencyId",
      label: "Nơi nhận báo cáo",
      type: "select",
      options: options.agencies,
    },
    {
      name: "followerUserId",
      label: "Người theo dõi, đôn đốc",
      type: "select",
      options: options.users,
    },
    {
      name: "departmentIds",
      label: "Đơn vị phải báo cáo",
      type: "checkboxes",
      required: true,
      options: options.departments,
      hint: "Mỗi đơn vị một bản nộp cho mỗi kỳ.",
    },
    {
      name: "autoCreateChild",
      label: "Khi nộp báo cáo",
      type: "checkbox",
      placeholder: "Tự thêm báo cáo đã nộp thành văn bản con của văn bản này",
      hint: "Chỉ thêm được nếu văn bản này chưa ở cấp cuối; nếu không, báo cáo chỉ lưu ở mục Theo dõi báo cáo.",
    },
    {
      name: "preview",
      label: "Xem trước",
      type: "custom",
      wide: true,
      render: (p) => <Preview values={p.values} />,
    },
  ];
  if (requirement)
    fields.push({
      name: "active",
      label: "Trạng thái",
      type: "checkbox",
      placeholder: "Đang áp dụng (bỏ chọn để ngừng sinh kỳ mới)",
    });

  return (
    <EntityFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={requirement ? "Sửa yêu cầu báo cáo" : "Yêu cầu báo cáo"}
      description={
        requirement
          ? "Kỳ đã nộp hoặc đã quá hạn được giữ nguyên; kỳ tương lai chưa nộp sẽ được sinh lại theo thông tin mới."
          : "Hệ thống tự sinh các kỳ báo cáo cho từng đơn vị và nhắc hạn."
      }
      fields={fields}
      schema={requirementSchema}
      defaultValues={{
        id: requirement?.id ?? "",
        documentId,
        name: requirement?.name ?? "",
        frequency: requirement?.frequency ?? "MONTHLY",
        onceDueDate: formatDate(requirement?.onceDueDate),
        dueDayOfPeriod: requirement?.dueDayOfPeriod?.toString() ?? "20",
        dueMonthOffset: String(requirement?.dueMonthOffset ?? 0),
        startDate: formatDate(requirement?.startDate),
        endDate: formatDate(requirement?.endDate),
        recipientAgencyId: requirement?.recipientAgencyId ?? "",
        departmentIds: requirement?.departmentIds ?? [],
        followerUserId: requirement?.followerUserId ?? "",
        autoCreateChild: requirement?.autoCreateChild ?? true,
        active: requirement?.active ?? true,
      }}
      submitLabel={requirement ? "Lưu thay đổi" : "Tạo yêu cầu & sinh kỳ"}
      successMessage={requirement ? "Đã lưu yêu cầu báo cáo." : "Đã tạo yêu cầu báo cáo."}
      action={async (values) => {
        const r = await saveRequirement(values as never);
        if (r.ok)
          toast.info(
            `Đã sinh ${formatNumber(r.data.periods)} kỳ báo cáo${r.data.removed ? ` (bỏ ${r.data.removed} kỳ tương lai cũ)` : ""}.`,
          );
        return r;
      }}
      onSuccess={() => router.refresh()}
    />
  );
}
