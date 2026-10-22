"use client";

// Biểu đồ Bảng điều hành (thiết kế lại 22/10/2026) — theo skill dataviz:
//  - Trạng thái dùng màu trạng thái Mục 3.3 (đã kiểm bằng validate_palette), luôn kèm biểu tượng + nhãn + số.
//  - Xu hướng: dạng "nhấn mạnh" — Hoàn thành màu chính (--chart-1), Giao mới xám.
//  - Khe 2px màu nền giữa các đoạn ghép; nét mảnh, lưới mờ; mọi cột bấm được → danh sách lọc sẵn.
import {
  CheckCheck,
  CircleAlert,
  Clock,
  Hourglass,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";

import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

const n = formatNumber;
/** Màu xám nhấn-phụ (chuỗi bối cảnh) — đủ tương phản 2,5:1, luôn có nhãn/tooltip đi kèm */
const MUTED = "#94a3b8";

const AXIS_TICK = { fill: "var(--muted-foreground)", fontSize: 13 };

// ---------------------------------------------------------------- Chú thích & tooltip dùng chung

type LegendItem = { key: string; label: string; color: string; icon?: LucideIcon };

function Legend({ items }: { items: LegendItem[] }) {
  return (
    <ul
      className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground"
      aria-label="Chú thích"
    >
      {items.map((i) => (
        <li key={i.key} className="flex items-center gap-1.5">
          {i.icon ? (
            <i.icon className="size-4" style={{ color: i.color }} aria-hidden />
          ) : (
            <span className="size-3 rounded-sm" style={{ background: i.color }} aria-hidden />
          )}
          {i.label}
        </li>
      ))}
    </ul>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  unit,
}: Partial<TooltipContentProps<number, string>> & { unit: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md">
      <p className="mb-1 font-semibold">{label}</p>
      <ul className="flex flex-col gap-0.5">
        {[...payload].reverse().map((p) => (
          <li key={String(p.dataKey)} className="flex items-center gap-2">
            <span className="size-2.5 rounded-sm" style={{ background: p.color }} aria-hidden />
            <span className="flex-1">{p.name}</span>
            <span className="font-semibold tabular-nums">
              {n(Number(p.value))} {unit}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------- Cơ cấu công việc theo trạng thái

export type StatusPart = {
  key: string;
  label: string;
  value: number;
  color: string;
  icon: LucideIcon;
  href: string;
  testId?: string;
};

/** Một thanh ngang 100% chia theo trạng thái (khe 2px) + danh sách số liệu bấm được */
export function StatusBreakdown({ parts, unit }: { parts: StatusPart[]; unit: string }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-baseline gap-2">
        <span className="text-stat leading-none font-bold">{n(total)}</span>
        <span className="text-muted-foreground">{unit} đang theo dõi</span>
      </p>
      {total > 0 ? (
        <div className="flex h-5 w-full gap-0.5" aria-hidden>
          {parts
            .filter((p) => p.value > 0)
            .map((p) => (
              <Link
                key={p.key}
                href={p.href as never}
                tabIndex={-1}
                title={`${p.label}: ${n(p.value)} ${unit}`}
                className="h-full min-w-1.5 first:rounded-l-[4px] last:rounded-r-[4px] hover:opacity-85"
                style={{ flexGrow: p.value, background: p.color }}
              />
            ))}
        </div>
      ) : (
        <div className="h-5 rounded bg-muted" aria-hidden />
      )}
      <ul className="flex flex-col divide-y">
        {parts.map((p) => (
          <li key={p.key}>
            <Link
              href={p.href as never}
              data-testid={p.testId}
              className="flex items-center gap-3 rounded-md px-1 py-2 transition hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <p.icon className="size-5 shrink-0" style={{ color: p.color }} aria-hidden />
              <span className="min-w-0 flex-1">{p.label}</span>
              <span className="text-2xl leading-none font-bold" data-value>
                {n(p.value)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const TASK_STATUS_ICONS = { CircleAlert, TriangleAlert, Hourglass, CheckCheck };

// ---------------------------------------------------------------- Xu hướng 6 tháng (cột nhóm)

export type TrendDatum = { key: string; label: string; assigned: number; done: number };

const monthText = (key: string) => key.split("-").reverse().join("/");

export function TrendChart({ data }: { data: TrendDatum[] }) {
  const router = useRouter();
  const empty = data.every((d) => d.assigned === 0 && d.done === 0);
  return (
    <figure
      aria-label="Công việc giao mới và hoàn thành 6 tháng gần nhất"
      className="flex flex-col gap-3"
    >
      <Legend
        items={[
          { key: "assigned", label: "Giao mới", color: MUTED },
          { key: "done", label: "Hoàn thành", color: "var(--chart-1)" },
        ]}
      />
      {empty ? (
        <p className="py-10 text-center text-muted-foreground">
          Chưa có công việc trong 6 tháng gần đây.
        </p>
      ) : (
        <div className="h-60" aria-hidden>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
              barGap={2}
              barCategoryGap="28%"
            >
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
                tick={AXIS_TICK}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tick={AXIS_TICK}
                width={40}
              />
              <Tooltip
                cursor={{ fill: "var(--muted)", opacity: 0.6 }}
                content={<ChartTooltip unit="việc" />}
              />
              <Bar
                dataKey="assigned"
                name="Giao mới"
                fill={MUTED}
                radius={[4, 4, 0, 0]}
                maxBarSize={22}
                cursor="pointer"
                isAnimationActive={false}
                onClick={(d) =>
                  router.push(`/cong-viec?giao=${(d as unknown as TrendDatum).key}` as never)
                }
              />
              <Bar
                dataKey="done"
                name="Hoàn thành"
                fill="var(--chart-1)"
                radius={[4, 4, 0, 0]}
                maxBarSize={22}
                cursor="pointer"
                isAnimationActive={false}
                onClick={(d) =>
                  router.push(
                    `/cong-viec?trangThai=XONG&xong=${(d as unknown as TrendDatum).key}` as never,
                  )
                }
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <ul className="sr-only">
        {data.map((d) => (
          <li key={d.key}>
            Tháng {monthText(d.key)}:{" "}
            <Link href={`/cong-viec?giao=${d.key}` as never}>giao mới {d.assigned} việc</Link>,{" "}
            <Link href={`/cong-viec?trangThai=XONG&xong=${d.key}` as never}>
              hoàn thành {d.done} việc
            </Link>
          </li>
        ))}
      </ul>
    </figure>
  );
}

// ---------------------------------------------------------------- Báo cáo theo tháng (cột chồng)

export type ReportMonthDatum = {
  key: string;
  label: string;
  onTime: number;
  late: number;
  overdue: number;
  pending: number;
};

const REPORT_SERIES = [
  {
    key: "onTime",
    label: "Nộp đúng hạn",
    color: "var(--status-done)",
    icon: CheckCheck,
    status: "HOAN_THANH",
  },
  {
    key: "late",
    label: "Nộp trễ",
    color: "var(--status-due-soon)",
    icon: Clock,
    status: "HOAN_THANH_TRE",
  },
  {
    key: "overdue",
    label: "Quá hạn chưa nộp",
    color: "var(--status-overdue)",
    icon: CircleAlert,
    status: "QUA_HAN",
  },
  { key: "pending", label: "Chưa đến hạn", color: MUTED, icon: Hourglass, status: "" },
] as const;

const reportHref = (month: string, status: string) =>
  `/bao-cao?thang=${month}${status ? `&trangThai=${status}` : ""}`;

export function ReportMonthsChart({ data }: { data: ReportMonthDatum[] }) {
  const router = useRouter();
  const empty = data.every((d) => d.onTime + d.late + d.overdue + d.pending === 0);
  return (
    <figure
      aria-label="Tình hình nộp báo cáo theo tháng của hạn nộp"
      className="flex h-full flex-col gap-3"
    >
      <Legend
        items={REPORT_SERIES.map((s) => ({
          key: s.key,
          label: s.label,
          color: s.color,
          icon: s.icon,
        }))}
      />
      {empty ? (
        <p className="py-10 text-center text-muted-foreground">
          Chưa có kỳ báo cáo trong 6 tháng gần đây.
        </p>
      ) : (
        <div className="h-60 xl:h-auto xl:min-h-60 xl:flex-1" aria-hidden>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
              barCategoryGap="32%"
            >
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
                tick={AXIS_TICK}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tick={AXIS_TICK}
                width={40}
              />
              <Tooltip
                cursor={{ fill: "var(--muted)", opacity: 0.6 }}
                content={<ChartTooltip unit="kỳ" />}
              />
              {REPORT_SERIES.map((s, i) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  name={s.label}
                  stackId="kỳ"
                  fill={s.color}
                  // Khe 2px màu nền giữa các đoạn ghép
                  stroke="var(--card)"
                  strokeWidth={2}
                  radius={i === REPORT_SERIES.length - 1 ? [4, 4, 0, 0] : 0}
                  maxBarSize={28}
                  cursor="pointer"
                  isAnimationActive={false}
                  onClick={(d) =>
                    router.push(
                      reportHref((d as unknown as ReportMonthDatum).key, s.status) as never,
                    )
                  }
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <ul className="sr-only">
        {data.map((d) => (
          <li key={d.key}>
            Tháng {monthText(d.key)}:{" "}
            {REPORT_SERIES.map((s) => (
              <Link key={s.key} href={reportHref(d.key, s.status) as never}>
                {s.label} {d[s.key]} kỳ;{" "}
              </Link>
            ))}
          </li>
        ))}
      </ul>
    </figure>
  );
}

// ---------------------------------------------------------------- Tiến độ chương trình (thước đo)

export function ProgressMeters({
  items,
}: {
  items: { id: string; title: string; progress: number | null; hasOverdue: boolean }[];
}) {
  if (items.length === 0)
    return <p className="py-6 text-center text-muted-foreground">Chưa có chương trình nào.</p>;
  return (
    <ul className="flex flex-col gap-3">
      {items.map((p) => (
        <li key={p.id}>
          <Link
            href={`/van-ban/${p.id}` as never}
            className="block rounded-md px-1 py-1 hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring"
          >
            <span className="flex items-center gap-2">
              {p.hasOverdue && (
                <CircleAlert
                  className="size-4 shrink-0 text-status-overdue"
                  aria-label="Có việc quá hạn"
                />
              )}
              <span className="min-w-0 flex-1 truncate">{p.title}</span>
              <span className="font-semibold">{p.progress === null ? "—" : `${p.progress}%`}</span>
            </span>
            {/* Thước: rãnh là bậc nhạt của cùng màu */}
            <span
              className="mt-1.5 block h-2 overflow-hidden rounded-full bg-brand-soft"
              aria-hidden
            >
              <span
                className={cn("block h-full rounded-full")}
                style={{ width: `${p.progress ?? 0}%`, background: "var(--chart-1)" }}
              />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
