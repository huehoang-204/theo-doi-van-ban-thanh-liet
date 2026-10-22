"use client";

import { ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Thẻ số liệu gọn (Mục 7.1): nhãn + biểu tượng, con số lớn (38px trên máy tính, co theo màn hình nhỏ),
 * tối đa một dòng phụ. Ngày cập nhật ghi ở tiêu đề khối (và trong `title` của thẻ). Cả thẻ bấm được.
 */
export function StatTile({
  href,
  icon: Icon,
  value,
  unit,
  label,
  sub,
  updatedAt,
  note,
  testId,
}: {
  href: string;
  icon: LucideIcon;
  value: string;
  unit?: string;
  label: string;
  sub?: React.ReactNode;
  updatedAt?: string | null;
  /** Ghi chú nhỏ (VD "Số nhập tay") */
  note?: string;
  testId?: string;
}) {
  return (
    <Link
      href={href as never}
      data-testid={testId}
      title={updatedAt ? `${label} — cập nhật ngày ${updatedAt}` : label}
      className="group flex min-w-0 flex-col rounded-xl border bg-card p-3 shadow-sm transition hover:border-brand/50 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:p-4"
    >
      <span className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-5 shrink-0 text-brand" aria-hidden />
        <span className="truncate font-medium text-foreground">{label}</span>
        {note && (
          <span className="ml-auto shrink-0 rounded bg-muted px-1.5 text-xs font-medium">
            {note}
          </span>
        )}
      </span>
      <span className="mt-2 flex flex-wrap items-baseline gap-x-1.5">
        <span
          className="text-[clamp(1.75rem,7.5vw,var(--text-stat))] leading-tight font-bold tracking-tight text-foreground"
          data-value
        >
          {value}
        </span>
        {unit && <span className="font-medium text-muted-foreground">{unit}</span>}
      </span>
      {sub && <span className="mt-0.5 truncate text-sm text-muted-foreground">{sub}</span>}
    </Link>
  );
}

/** Thẻ trạng thái công việc: vạch màu + biểu tượng mang trạng thái; con số dùng màu chữ */
export function StatusTile({
  href,
  icon: Icon,
  color,
  value,
  label,
  testId,
}: {
  href: string;
  icon: LucideIcon;
  color: string;
  value: number;
  label: string;
  testId?: string;
}) {
  return (
    <Link
      href={href as never}
      data-testid={testId}
      className="group flex items-center gap-4 rounded-xl border border-l-[6px] bg-card p-4 shadow-sm transition hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      style={{ borderLeftColor: color }}
    >
      <Icon className="size-8 shrink-0" style={{ color }} aria-hidden />
      <span className="flex flex-col">
        <span className="text-stat leading-none font-bold text-foreground tabular-nums" data-value>
          {formatNumber(value)}
        </span>
        <span className="mt-1 font-medium text-muted-foreground">{label}</span>
      </span>
      <ChevronRight
        className="ml-auto size-5 text-muted-foreground opacity-0 transition group-hover:opacity-100"
        aria-hidden
      />
    </Link>
  );
}

/** Khung một khối biểu đồ/bảng */
export function Panel({
  title,
  action,
  children,
  className,
  footer,
}: {
  title: string;
  action?: { href: string; label: string };
  children: React.ReactNode;
  className?: string;
  footer?: React.ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className={cn(
        "flex min-w-0 flex-col rounded-xl border bg-card p-4 shadow-sm sm:p-5",
        className,
      )}
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="min-w-0 text-lg font-semibold">{title}</h3>
        {action && (
          <Link
            href={action.href as never}
            className="shrink-0 text-[0.9375rem] font-medium text-brand underline-offset-4 hover:underline"
          >
            {action.label}
          </Link>
        )}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
      {footer && <div className="mt-3 text-sm text-muted-foreground">{footer}</div>}
    </section>
  );
}

export function SectionHeading({ title, note }: { title: string; note?: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b pb-2">
      <h2 className="text-xl font-bold text-brand">{title}</h2>
      {note && <span className="text-muted-foreground">{note}</span>}
    </div>
  );
}

export type BarDatum = { key: string; label: string; value: number; href: string };

/**
 * Biểu đồ thanh ngang (recharts): một màu, nhãn số ở cuối thanh, bấm thanh → danh sách lọc sẵn.
 * Có danh sách liên kết ẩn cho bàn phím/trình đọc màn hình (mọi con số đều bấm được).
 */
export function HBarChart({
  data,
  color = "var(--chart-1)",
  unit,
  label,
}: {
  data: BarDatum[];
  color?: string;
  unit: string;
  label: string;
}) {
  const router = useRouter();
  if (data.length === 0)
    return <p className="py-6 text-center text-muted-foreground">Chưa có số liệu.</p>;
  const height = data.length * 38 + 16;
  const labelWidth = Math.min(190, Math.max(80, Math.max(...data.map((d) => d.label.length)) * 8));
  return (
    <figure aria-label={label} className="w-full">
      <div style={{ height }} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 52, bottom: 4, left: 4 }}
            barCategoryGap={8}
          >
            <CartesianGrid horizontal={false} stroke="var(--border)" />
            <XAxis type="number" hide allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="label"
              width={labelWidth}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--foreground)", fontSize: 14 }}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)" }}
              formatter={(v) => [`${formatNumber(Number(v))} ${unit}`, ""]}
              separator=""
              contentStyle={{
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--popover)",
                color: "var(--popover-foreground)",
                fontSize: 14,
              }}
            />
            <Bar
              dataKey="value"
              radius={[0, 4, 4, 0]}
              maxBarSize={22}
              cursor="pointer"
              isAnimationActive={false}
              onClick={(d) => router.push((d as unknown as BarDatum).href as never)}
            >
              {data.map((d) => (
                <Cell key={d.key} fill={color} />
              ))}
              <LabelList
                dataKey="value"
                position="right"
                formatter={(v) => formatNumber(Number(v))}
                style={{ fill: "var(--foreground)", fontSize: 14, fontWeight: 600 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="sr-only">
        {data.map((d) => (
          <li key={d.key}>
            <Link href={d.href as never}>
              {d.label}: {formatNumber(d.value)} {unit}
            </Link>
          </li>
        ))}
      </ul>
    </figure>
  );
}
