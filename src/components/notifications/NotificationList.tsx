"use client";

import { CheckCheck, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { EmptyState } from "@/components/common/EmptyState";
import { NotificationIcon } from "@/components/common/NotificationIcon";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatTimeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { markAllNotificationsRead, markNotificationRead } from "@/server/actions/notifications";
import type { NotificationDTO } from "@/server/notifications";

type Props = {
  items: NotificationDTO[];
  unread: number;
  total: number;
  unreadOnly: boolean;
  page: number;
  pageCount: number;
};

export function NotificationList({ items, unread, total, unreadOnly, page, pageCount }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const href = (p: { chuaDoc?: boolean; trang?: number }) => {
    const q = new URLSearchParams();
    if (p.chuaDoc ?? unreadOnly) q.set("chuaDoc", "1");
    if ((p.trang ?? 1) > 1) q.set("trang", String(p.trang));
    const s = q.toString();
    return (s ? `/thong-bao?${s}` : "/thong-bao") as never;
  };

  function open(n: NotificationDTO) {
    startTransition(async () => {
      if (!n.readAt) await markNotificationRead({ id: n.id });
      router.push(n.link as never);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="inline-flex rounded-lg bg-muted p-1"
          role="group"
          aria-label="Lọc thông báo"
        >
          {[
            [false, `Tất cả`],
            [true, `Chưa đọc (${unread})`],
          ].map(([only, label]) => (
            <Link
              key={String(only)}
              href={href({ chuaDoc: only as boolean, trang: 1 })}
              aria-current={unreadOnly === only ? "page" : undefined}
              className={cn(
                "rounded-md px-4 py-1.5 font-medium",
                unreadOnly === only ? "bg-card text-brand shadow-sm" : "text-muted-foreground",
              )}
            >
              {label as string}
            </Link>
          ))}
        </div>
        {unread > 0 && (
          <Button
            variant="outline"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await markAllNotificationsRead({});
                router.refresh();
              })
            }
          >
            <CheckCheck aria-hidden />
            Đánh dấu tất cả đã đọc
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState
          title={unreadOnly ? "Không có thông báo chưa đọc" : "Chưa có thông báo nào"}
          description="Hệ thống nhắc việc/báo cáo còn 3 ngày, 1 ngày và khi quá hạn — lúc 06:30 hằng ngày."
        />
      ) : (
        <ul className="overflow-hidden rounded-xl border bg-card" aria-label="Danh sách thông báo">
          {items.map((n) => (
            <li key={n.id} className="border-b last:border-b-0">
              <button
                type="button"
                onClick={() => open(n)}
                disabled={pending}
                className={cn(
                  "flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-muted focus-visible:bg-muted focus-visible:outline-none",
                  !n.readAt && "bg-brand-soft/40",
                )}
              >
                <NotificationIcon kind={n.kind} className="mt-0.5" />
                <span className="min-w-0 flex-1">
                  <span className={cn("block", !n.readAt && "font-semibold")}>{n.title}</span>
                  <span className="text-sm text-muted-foreground" suppressHydrationWarning>
                    {formatTimeAgo(n.createdAt)} · {formatDateTime(new Date(n.createdAt))}
                  </span>
                </span>
                {!n.readAt && (
                  <span className="mt-2 flex shrink-0 items-center gap-1.5 text-sm font-medium text-brand">
                    <span className="size-2.5 rounded-full bg-brand" aria-hidden />
                    <span className="sr-only sm:not-sr-only">Chưa đọc</span>
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {pageCount > 1 && (
        <nav
          className="flex items-center justify-between text-muted-foreground"
          aria-label="Phân trang"
        >
          <span>
            {total} thông báo · Trang {page}/{pageCount}
          </span>
          <span className="flex gap-2">
            {page > 1 && (
              <Button variant="outline" size="icon-sm" asChild>
                <Link href={href({ trang: page - 1 })} aria-label="Trang trước">
                  <ChevronLeft aria-hidden />
                </Link>
              </Button>
            )}
            {page < pageCount && (
              <Button variant="outline" size="icon-sm" asChild>
                <Link href={href({ trang: page + 1 })} aria-label="Trang sau">
                  <ChevronRight aria-hidden />
                </Link>
              </Button>
            )}
          </span>
        </nav>
      )}
    </div>
  );
}
