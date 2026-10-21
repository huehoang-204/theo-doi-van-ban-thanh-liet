"use client";

import { Download, RotateCcw, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { DateInput } from "@/components/common/DateInput";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

export type AuditFilterValues = {
  nguoi: string;
  doiTuong: string;
  ma: string;
  hanhDong: string;
  tu: string;
  den: string;
};

type Option = { value: string; label: string };

type Props = {
  values: AuditFilterValues;
  users: Option[];
  entities: Option[];
  actions: Option[];
  /** Nhãn đối tượng cụ thể đang lọc (?ma=) */
  entityIdLabel?: string | null;
};

const DATE_RE = /^\d{1,2}\/\d{1,2}\/\d{4}$/;

function query(v: AuditFilterValues): string {
  const q = new URLSearchParams();
  for (const [k, val] of Object.entries(v)) if (val.trim()) q.set(k, val.trim());
  return q.toString();
}

/** Thanh lọc nhật ký: người thực hiện, đối tượng, hành động, từ ngày – đến ngày (ghi lên URL) */
export function AuditFilters({ values, users, entities, actions, entityIdLabel }: Props) {
  const router = useRouter();
  const [v, setV] = useState(values);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof AuditFilterValues) => (val: string) => setV((s) => ({ ...s, [k]: val }));

  function apply(e?: React.FormEvent) {
    e?.preventDefault();
    for (const [k, label] of [
      ["tu", "Từ ngày"],
      ["den", "Đến ngày"],
    ] as const) {
      if (v[k] && !DATE_RE.test(v[k])) {
        setError(`${label} phải có dạng ngày/tháng/năm, VD 21/10/2026.`);
        return;
      }
    }
    setError(null);
    const q = query(v);
    router.push((q ? `/quan-tri/nhat-ky?${q}` : "/quan-tri/nhat-ky") as never);
  }

  const exportQuery = query(values);

  return (
    <form
      onSubmit={apply}
      className="mb-4 rounded-xl border bg-card p-4 shadow-sm"
      aria-label="Lọc nhật ký"
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="audit-user">Người thực hiện</Label>
          <NativeSelect
            className="w-full"
            id="audit-user"
            value={v.nguoi}
            onChange={(e) => set("nguoi")(e.target.value)}
          >
            <NativeSelectOption value="">Tất cả</NativeSelectOption>
            {users.map((u) => (
              <NativeSelectOption key={u.value} value={u.value}>
                {u.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="audit-entity">Đối tượng</Label>
          <NativeSelect
            className="w-full"
            id="audit-entity"
            value={v.doiTuong}
            onChange={(e) => setV((s) => ({ ...s, doiTuong: e.target.value, ma: "" }))}
          >
            <NativeSelectOption value="">Tất cả</NativeSelectOption>
            {entities.map((o) => (
              <NativeSelectOption key={o.value} value={o.value}>
                {o.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="audit-action">Hành động</Label>
          <NativeSelect
            className="w-full"
            id="audit-action"
            value={v.hanhDong}
            onChange={(e) => set("hanhDong")(e.target.value)}
          >
            <NativeSelectOption value="">Tất cả</NativeSelectOption>
            {actions.map((o) => (
              <NativeSelectOption key={o.value} value={o.value}>
                {o.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="audit-from">Từ ngày</Label>
          <DateInput id="audit-from" label="Từ ngày" value={v.tu} onChange={set("tu")} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="audit-to">Đến ngày</Label>
          <DateInput id="audit-to" label="Đến ngày" value={v.den} onChange={set("den")} />
        </div>
      </div>

      {entityIdLabel && v.ma && (
        <p className="mt-3 text-muted-foreground">
          Đang xem lịch sử của: <strong className="text-foreground">{entityIdLabel}</strong>{" "}
          <button
            type="button"
            className="text-brand underline underline-offset-2"
            onClick={() => setV((s) => ({ ...s, ma: "" }))}
          >
            Bỏ lọc đối tượng này
          </button>
        </p>
      )}
      {error && (
        <p className="mt-3 text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="submit">
          <Search aria-hidden />
          Lọc
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setV({ nguoi: "", doiTuong: "", ma: "", hanhDong: "", tu: "", den: "" });
            router.push("/quan-tri/nhat-ky");
          }}
        >
          <RotateCcw aria-hidden />
          Xoá bộ lọc
        </Button>
        <Button type="button" variant="outline" className="sm:ml-auto" asChild>
          <a href={`/api/export/audit-log${exportQuery ? `?${exportQuery}` : ""}`} download>
            <Download aria-hidden />
            Xuất Excel
          </a>
        </Button>
      </div>
    </form>
  );
}
