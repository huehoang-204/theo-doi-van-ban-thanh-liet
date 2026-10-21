"use client";

import { Bell, CheckCheck } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";

import { NotificationIcon } from "@/components/common/NotificationIcon";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatTimeAgo } from "@/lib/format";
import { vi } from "@/lib/i18n/vi";
import { cn } from "@/lib/utils";
import { markAllNotificationsRead, markNotificationRead } from "@/server/actions/notifications";
import type { NotificationDTO } from "@/server/notifications";

const POLL_MS = 60_000;

/** Chuông thông báo (Mục 5.4): badge số chưa đọc, 10 thông báo mới nhất; tự cập nhật mỗi phút */
export function NotificationBell() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ items: NotificationDTO[]; unread: number } | null>(null);
  const [pending, startTransition] = useTransition();

  // setState nằm trong callback của promise (không gọi đồng bộ trong effect)
  const load = useCallback(
    () =>
      fetch("/api/notifications?soLuong=10", { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : null))
        .then((d) => d && setData(d))
        .catch(() => undefined), // mất mạng tạm thời: giữ số cũ, lần sau thử lại
    [],
  );

  // Tải lần đầu, mỗi phút, khi quay lại cửa sổ, và khi chuyển trang (VD vừa duyệt việc)
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [load, pathname]);

  const unread = data?.unread ?? 0;

  function openItem(n: NotificationDTO) {
    setOpen(false);
    if (!n.readAt) {
      setData(
        (d) =>
          d && {
            unread: Math.max(0, d.unread - 1),
            items: d.items.map((x) =>
              x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x,
            ),
          },
      );
      void markNotificationRead({ id: n.id });
    }
    router.push(n.link as never);
  }

  function readAll() {
    startTransition(async () => {
      await markAllNotificationsRead({});
      await load();
    });
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) void load();
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative size-11 text-white hover:bg-white/15 hover:text-white"
          aria-label={
            unread > 0 ? `${vi.layout.notifications} (${unread} chưa đọc)` : vi.layout.notifications
          }
          title={vi.layout.notifications}
        >
          <Bell className="size-5" aria-hidden />
          {unread > 0 && (
            <span
              data-testid="notification-badge"
              className="absolute top-1 right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-red px-1 text-xs leading-none font-bold text-white ring-2 ring-brand"
              aria-hidden
            >
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(26rem,calc(100vw-1.5rem))] gap-0 p-0"
        aria-label={vi.layout.notifications}
      >
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <h2 className="text-lg font-bold">
            {vi.layout.notifications}
            {unread > 0 && (
              <span className="ml-2 text-base font-normal text-muted-foreground">
                {unread} chưa đọc
              </span>
            )}
          </h2>
          {unread > 0 && (
            <Button variant="ghost" size="sm" onClick={readAll} disabled={pending}>
              <CheckCheck aria-hidden />
              Đọc tất cả
            </Button>
          )}
        </div>

        {!data ? (
          <p className="px-4 py-8 text-center text-muted-foreground">Đang tải…</p>
        ) : data.items.length === 0 ? (
          <div className="px-4 py-10 text-center text-muted-foreground">
            <Bell className="mx-auto mb-2 size-8 opacity-40" aria-hidden />
            Chưa có thông báo nào.
          </div>
        ) : (
          <ul className="max-h-[min(28rem,70vh)] overflow-y-auto" aria-label="Thông báo mới nhất">
            {data.items.map((n) => (
              <li key={n.id} className="border-b last:border-b-0">
                <button
                  type="button"
                  onClick={() => openItem(n)}
                  className={cn(
                    "flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-muted focus-visible:bg-muted focus-visible:outline-none",
                    !n.readAt && "bg-brand-soft/40",
                  )}
                >
                  <NotificationIcon kind={n.kind} className="mt-0.5" />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block", !n.readAt && "font-semibold")}>{n.title}</span>
                    <span className="text-sm text-muted-foreground">
                      {formatTimeAgo(n.createdAt)}
                    </span>
                  </span>
                  {!n.readAt && (
                    <span
                      className="mt-2 size-2.5 shrink-0 rounded-full bg-brand"
                      aria-label="Chưa đọc"
                    />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="border-t p-2">
          <Button variant="ghost" className="w-full" asChild>
            <Link href="/thong-bao" onClick={() => setOpen(false)}>
              Xem tất cả thông báo
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
