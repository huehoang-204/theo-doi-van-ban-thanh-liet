"use client";

import { MonitorPlay } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { DashboardData } from "@/server/dashboard/data";

import { DashboardBody } from "./DashboardBody";

export async function fetchDashboard(schoolYear?: string): Promise<DashboardData> {
  const res = await fetch(
    `/api/dashboard${schoolYear ? `?schoolYear=${encodeURIComponent(schoolYear)}` : ""}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error("Không tải được số liệu bảng điều hành.");
  return (await res.json()) as DashboardData;
}

/** Trang Bảng điều hành: số liệu ban đầu từ máy chủ; đổi năm học → gọi lại /api/dashboard (1 lần gọi) */
export function DashboardScreen({
  initial,
  wardName,
}: {
  initial: DashboardData;
  wardName: string;
}) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);

  async function changeYear(year: string) {
    setLoading(true);
    try {
      setData(await fetchDashboard(year));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b pb-4">
        <div>
          <h1 className="text-page-title font-bold tracking-wide text-brand uppercase">
            {wardName} — Bảng điều hành
          </h1>
          <p className="mt-1 text-muted-foreground">
            {data.today} · Số liệu lúc {data.generatedAt.slice(-5)}
          </p>
        </div>
        {data.view !== "officer" && (
          <Button variant="outline" size="lg" asChild>
            <Link href="/trinh-chieu">
              <MonitorPlay aria-hidden />
              Trình chiếu
            </Link>
          </Button>
        )}
      </header>
      <DashboardBody data={data} onSchoolYearChange={changeYear} loadingYear={loading} />
    </div>
  );
}
