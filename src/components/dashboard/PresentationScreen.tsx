"use client";

import { ArrowLeft, Expand, RefreshCw, Shrink } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { formatLongDate } from "@/lib/format";
import type { DashboardData } from "@/server/dashboard/data";

import { DashboardBody } from "./DashboardBody";
import { fetchDashboard } from "./DashboardScreen";

const REFRESH_MS = 5 * 60 * 1000;
/** Chữ to hơn khi chiếu lên TV phòng họp (Mục 7.1) */
const PRESENT_SCALE = "1.25";

/** Chế độ trình chiếu: toàn màn hình, chữ to, tự làm mới 5 phút/lần */
export function PresentationScreen({
  initial,
  wardName,
}: {
  initial: DashboardData;
  wardName: string;
}) {
  const [data, setData] = useState(initial);
  const [lastRefresh, setLastRefresh] = useState<string>(initial.generatedAt.slice(-5));
  const [clock, setClock] = useState<string>("");
  const [fullscreen, setFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await fetchDashboard(data.education.schoolYear);
      setData(next);
      setLastRefresh(next.generatedAt.slice(-5));
      setError(null);
    } catch {
      setError("Mất kết nối — đang hiển thị số liệu lần trước.");
    }
  }, [data.education.schoolYear]);

  // Tự làm mới 5 phút/lần
  useEffect(() => {
    const timer = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  // Đồng hồ
  useEffect(() => {
    const tick = () =>
      setClock(
        new Intl.DateTimeFormat("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Asia/Ho_Chi_Minh",
        }).format(new Date()),
      );
    tick();
    const timer = setInterval(tick, 15_000);
    return () => clearInterval(timer);
  }, []);

  // Chữ to hơn trong chế độ trình chiếu; trả lại cỡ chữ người dùng khi rời trang
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.getPropertyValue("--font-scale");
    root.style.setProperty("--font-scale", PRESENT_SCALE);
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => {
      root.style.setProperty("--font-scale", previous);
      document.removeEventListener("fullscreenchange", onChange);
    };
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => undefined);
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-20 flex flex-wrap items-center gap-4 bg-brand px-6 py-3 text-white shadow">
        <span
          aria-hidden
          className="flex size-12 items-center justify-center rounded-lg bg-accent-red text-xl font-bold"
        >
          TL
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold tracking-wide uppercase">
            {wardName} — Bảng điều hành
          </h1>
          <p className="text-white/80">
            {formatLongDate(new Date())} · Cập nhật lúc {lastRefresh} · tự làm mới 5 phút/lần
            {error && <span className="ml-2 font-semibold text-amber-200">{error}</span>}
          </p>
        </div>
        <span
          className="text-4xl font-bold tabular-nums"
          aria-label="Giờ hiện tại"
          suppressHydrationWarning
        >
          {clock}
        </span>
        <div className="no-print flex gap-2">
          <Button
            variant="ghost"
            size="icon-lg"
            className="text-white hover:bg-white/15 hover:text-white"
            onClick={() => void refresh()}
            aria-label="Làm mới ngay"
            title="Làm mới ngay"
          >
            <RefreshCw aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon-lg"
            className="text-white hover:bg-white/15 hover:text-white"
            onClick={toggleFullscreen}
            aria-label={fullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
            title={fullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
          >
            {fullscreen ? <Shrink aria-hidden /> : <Expand aria-hidden />}
          </Button>
          <Button
            variant="ghost"
            size="icon-lg"
            className="text-white hover:bg-white/15 hover:text-white"
            asChild
          >
            <Link href="/" aria-label="Thoát trình chiếu" title="Thoát trình chiếu">
              <ArrowLeft aria-hidden />
            </Link>
          </Button>
        </div>
      </header>
      <main className="px-6 py-6">
        <DashboardBody data={data} present />
      </main>
    </div>
  );
}
