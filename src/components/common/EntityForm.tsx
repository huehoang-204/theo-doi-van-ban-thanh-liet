"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useId } from "react";
import { Controller, useForm, useWatch, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { DateInput } from "@/components/common/DateInput";
import { FormField } from "@/components/common/FormField";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/server/errors";

export type Option = { value: string; label: string };

export type FieldConfig = {
  name: string;
  label: string;
  type?:
    | "text"
    | "textarea"
    | "number"
    | "decimal"
    | "checkbox"
    | "select"
    | "checkboxes"
    | "color"
    | "date"
    | "password"
    | "email"
    | "tel"
    | "custom";
  required?: boolean;
  options?: Option[];
  /** Dòng đầu của ô chọn khi không bắt buộc (VD "— Không chọn —") */
  emptyOption?: string;
  placeholder?: string;
  hint?: string;
  /** Ô tuỳ biến (type "custom") */
  render?: (props: CustomFieldProps) => React.ReactNode;
  /** Chỉ hiện ô khi điều kiện đúng (theo giá trị hiện tại của form) */
  visibleWhen?: (values: FormValues) => boolean;
  /** Chiếm cả 2 cột */
  wide?: boolean;
  disabled?: boolean;
  autoComplete?: string;
};

export type FormValues = Record<string, unknown>;

export type CustomFieldProps = {
  id: string;
  value: unknown;
  onChange: (value: unknown) => void;
  onBlur: () => void;
  invalid: boolean;
  describedBy?: string;
  labelId: string;
  /** Giá trị hiện tại của cả form (VD để xem trước kết quả) */
  values: FormValues;
};

type EntityFormProps<T> = {
  fields: FieldConfig[];
  schema: z.ZodType;
  defaultValues: FormValues;
  action: (values: FormValues) => Promise<ActionResult<T>>;
  submitLabel?: string;
  successMessage?: string;
  onSuccess?: (data: T) => void;
  onCancel?: () => void;
};

/** Form theo cấu hình: kiểm tra lỗi khi rời ô (onTouched), gửi qua server action, hiện lỗi từng ô */
export function EntityForm<T>({
  fields,
  schema,
  defaultValues,
  action,
  submitLabel = "Lưu",
  successMessage = "Đã lưu thành công.",
  onSuccess,
  onCancel,
}: EntityFormProps<T>) {
  const formId = useId();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema as never) as unknown as Resolver<FormValues>,
    defaultValues,
    mode: "onTouched",
  });
  const { register, control, handleSubmit, setError, formState } = form;
  const values = useWatch({ control }) as FormValues;

  const submit = handleSubmit(async (values) => {
    const result = await action(values);
    if (!result.ok) {
      const fieldErrors = result.error.fieldErrors ?? {};
      for (const [name, message] of Object.entries(fieldErrors)) {
        if (fields.some((f) => f.name === name)) setError(name, { message }, { shouldFocus: true });
      }
      toast.error(result.error.message);
      return;
    }
    toast.success(successMessage);
    onSuccess?.(result.data);
  });

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fields.map((field) => {
          if (field.visibleWhen && !field.visibleWhen(values)) return null;
          const id = `${formId}-${field.name}`;
          const error = formState.errors[field.name]?.message as string | undefined;
          const describedBy = error ? `${id}-error` : undefined;
          const common = {
            id,
            "aria-invalid": !!error,
            "aria-describedby": describedBy,
            disabled: field.disabled,
          };
          const type = field.type ?? "text";

          let control_: React.ReactNode;
          switch (type) {
            case "textarea":
              control_ = (
                <Textarea
                  {...common}
                  {...register(field.name)}
                  placeholder={field.placeholder}
                  rows={3}
                />
              );
              break;
            case "select":
              control_ = (
                <NativeSelect className="w-full" {...common} {...register(field.name)}>
                  {(!field.required || field.emptyOption) && (
                    <NativeSelectOption value="">
                      {field.emptyOption ?? "— Không chọn —"}
                    </NativeSelectOption>
                  )}
                  {field.options?.map((o) => (
                    <NativeSelectOption key={o.value} value={o.value}>
                      {o.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              );
              break;
            case "checkbox":
              control_ = (
                <Controller
                  control={control}
                  name={field.name}
                  render={({ field: f }) => (
                    <label className="flex min-h-11 cursor-pointer items-center gap-3">
                      <Checkbox
                        id={id}
                        checked={f.value === true}
                        onCheckedChange={(v) => f.onChange(v === true)}
                        disabled={field.disabled}
                        className="size-5"
                      />
                      <span>{field.placeholder ?? "Có"}</span>
                    </label>
                  )}
                />
              );
              break;
            case "checkboxes":
              control_ = (
                <Controller
                  control={control}
                  name={field.name}
                  render={({ field: f }) => {
                    const value = Array.isArray(f.value) ? (f.value as string[]) : [];
                    return (
                      <div
                        id={id}
                        role="group"
                        aria-describedby={describedBy}
                        className="grid grid-cols-1 gap-1 sm:grid-cols-2"
                      >
                        {field.options?.map((o) => (
                          <label
                            key={o.value}
                            className="flex min-h-10 cursor-pointer items-center gap-3"
                          >
                            <Checkbox
                              checked={value.includes(o.value)}
                              onCheckedChange={(checked) =>
                                f.onChange(
                                  checked
                                    ? [...value, o.value]
                                    : value.filter((v) => v !== o.value),
                                )
                              }
                              onBlur={f.onBlur}
                              className="size-5"
                            />
                            <span>{o.label}</span>
                          </label>
                        ))}
                      </div>
                    );
                  }}
                />
              );
              break;
            case "date":
              control_ = (
                <Controller
                  control={control}
                  name={field.name}
                  render={({ field: f }) => (
                    <DateInput
                      id={id}
                      label={field.label}
                      value={typeof f.value === "string" ? f.value : ""}
                      onChange={f.onChange}
                      onBlur={f.onBlur}
                      invalid={!!error}
                      describedBy={describedBy}
                      disabled={field.disabled}
                    />
                  )}
                />
              );
              break;
            case "custom":
              control_ = (
                <Controller
                  control={control}
                  name={field.name}
                  render={({ field: f }) => (
                    <>
                      {field.render?.({
                        id,
                        value: f.value,
                        onChange: f.onChange,
                        onBlur: f.onBlur,
                        invalid: !!error,
                        describedBy,
                        labelId: `${id}-label`,
                        values,
                      })}
                    </>
                  )}
                />
              );
              break;
            case "color":
              control_ = (
                <div className="flex items-center gap-3">
                  <Input
                    {...common}
                    {...register(field.name)}
                    className="max-w-40 font-mono"
                    placeholder="#1E3A8A"
                  />
                  <Controller
                    control={control}
                    name={field.name}
                    render={({ field: f }) => (
                      <input
                        type="color"
                        aria-label={`Chọn ${field.label.toLowerCase()}`}
                        value={
                          /^#[0-9a-fA-F]{6}$/.test(String(f.value)) ? String(f.value) : "#1e3a8a"
                        }
                        onChange={(e) => f.onChange(e.target.value.toUpperCase())}
                        className="h-11 w-14 cursor-pointer rounded-lg border border-input bg-card p-1"
                      />
                    )}
                  />
                </div>
              );
              break;
            default:
              control_ = (
                <Input
                  {...common}
                  {...register(field.name)}
                  type={
                    type === "password"
                      ? "password"
                      : type === "email"
                        ? "email"
                        : type === "tel"
                          ? "tel"
                          : "text"
                  }
                  inputMode={
                    type === "number" ? "numeric" : type === "decimal" ? "decimal" : undefined
                  }
                  placeholder={field.placeholder}
                  autoComplete={
                    field.autoComplete ?? (type === "password" ? "new-password" : "off")
                  }
                />
              );
          }

          return (
            <FormField
              key={field.name}
              id={id}
              label={field.label}
              required={field.required}
              hint={field.hint}
              error={error}
              className={cn(
                field.wide || type === "textarea" || type === "checkboxes"
                  ? "sm:col-span-2"
                  : undefined,
              )}
            >
              {control_}
            </FormField>
          );
        })}
      </div>
      <div className="flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={onCancel}
            disabled={formState.isSubmitting}
          >
            Huỷ
          </Button>
        )}
        <Button type="submit" size="lg" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? "Đang lưu…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
