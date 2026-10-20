"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatNumber } from "@/lib/format";

/**
 * Số học sinh qua các năm học (Mục 6.2). Một chuỗi → không cần chú giải (tiêu đề đã gọi tên);
 * đường 2px, điểm 8px, lưới mờ, tooltip theo năm. Bảng số liệu bên dưới là dạng bảng tương đương.
 */
export function StudentTrendChart({ data }: { data: { schoolYear: string; students: number }[] }) {
  if (data.length < 2) {
    return (
      <p className="rounded-lg bg-muted p-4 text-muted-foreground">
        Cần số liệu ít nhất 2 năm học để vẽ biểu đồ.
      </p>
    );
  }
  return (
    <figure aria-label="Biểu đồ số học sinh qua các năm học" className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 16, bottom: 4, left: 8 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="schoolYear"
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            tick={{ fill: "var(--muted-foreground)", fontSize: 14 }}
          />
          {/* Đường xu hướng: trục không bắt đầu từ 0 để thấy biến động giữa các năm */}
          <YAxis
            domain={[
              (min: number) => Math.floor((min * 0.9) / 50) * 50,
              (max: number) => Math.ceil((max * 1.05) / 50) * 50,
            ]}
            tickFormatter={(v: number) => formatNumber(v)}
            tickLine={false}
            axisLine={false}
            width={56}
            tick={{ fill: "var(--muted-foreground)", fontSize: 14 }}
          />
          <Tooltip
            cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "4 4" }}
            formatter={(v) => [formatNumber(Number(v)), "Học sinh"]}
            labelFormatter={(l) => `Năm học ${String(l)}`}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--popover)",
              color: "var(--popover-foreground)",
            }}
          />
          <Line
            type="monotone"
            dataKey="students"
            stroke="var(--chart-1)"
            strokeWidth={2}
            dot={{ r: 4, strokeWidth: 2, stroke: "var(--card)", fill: "var(--chart-1)" }}
            activeDot={{ r: 6, strokeWidth: 2, stroke: "var(--card)" }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </figure>
  );
}
