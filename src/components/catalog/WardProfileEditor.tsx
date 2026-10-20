"use client";

import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { FieldConfig } from "@/components/common/EntityForm";
import { EntityFormDialog } from "@/components/common/EntityFormDialog";
import { Button } from "@/components/ui/button";
import { formatDate, formatDecimal } from "@/lib/format";
import { wardProfileSchema } from "@/lib/schemas/catalog";
import { updateWardProfile } from "@/server/actions/ward";

export type WardProfileValues = {
  name: string;
  city: string;
  areaKm2: number;
  population: number;
  populationIsEstimate: boolean;
  households: number | null;
  establishedDate: Date | null;
  address: string | null;
  phone: string | null;
};

const FIELDS: FieldConfig[] = [
  { name: "name", label: "Tên đơn vị", required: true },
  { name: "city", label: "Thành phố", required: true },
  {
    name: "areaKm2",
    label: "Diện tích tự nhiên (km²)",
    type: "decimal",
    required: true,
    placeholder: "VD: 6,44",
  },
  {
    name: "population",
    label: "Dân số (người)",
    type: "number",
    required: true,
    placeholder: "VD: 92.000",
  },
  {
    name: "populationIsEstimate",
    label: "Số liệu dân số",
    type: "checkbox",
    placeholder: "Là số ước tính (hiển thị “~”)",
  },
  { name: "households", label: "Số hộ", type: "number" },
  { name: "establishedDate", label: "Ngày thành lập", type: "date" },
  { name: "phone", label: "Điện thoại trụ sở", type: "tel" },
  { name: "address", label: "Địa chỉ trụ sở", wide: true },
];

export function WardProfileEditor({ values }: { values: WardProfileValues }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="lg" onClick={() => setOpen(true)}>
        <Pencil aria-hidden />
        Sửa thông tin
      </Button>
      <EntityFormDialog
        open={open}
        onOpenChange={setOpen}
        title="Sửa thông tin phường"
        description="Các con số này hiển thị trên Bảng điều hành."
        fields={FIELDS}
        schema={wardProfileSchema}
        defaultValues={{
          ...values,
          areaKm2: formatDecimal(values.areaKm2),
          population: String(values.population),
          households: values.households === null ? "" : String(values.households),
          establishedDate: formatDate(values.establishedDate),
          address: values.address ?? "",
          phone: values.phone ?? "",
        }}
        action={(v) => updateWardProfile(v as never)}
        onSuccess={() => router.refresh()}
      />
    </>
  );
}
