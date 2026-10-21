import type { Metadata } from "next";
import { ChevronRight, Inbox, Paperclip, Send } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/common/EmptyState";
import { formatDateTime } from "@/lib/format";
import { documentHeadline } from "@/lib/publish";
import { cn } from "@/lib/utils";
import { requirePermission } from "@/server/auth/current-user";
import { listPublished } from "@/server/documents/social";

export const metadata: Metadata = { title: "Văn bản mới ban hành" };

const FILTERS = [
  ["toi", "Gửi đến tôi"],
  ["chua-xem", "Chưa xem"],
  ["tat-ca", "Tất cả văn bản ban hành"],
] as const;
type Filter = (typeof FILTERS)[number][0];

/** Văn bản mới ban hành (GĐ5b): dòng thời gian theo ngày, "ĐƠN VỊ đã ban hành văn bản …", chưa xem in đậm */
export default async function PublishedPage({ searchParams }: PageProps<"/van-ban/ban-hanh">) {
  const user = await requirePermission("document.list");
  const { loc } = await searchParams;
  const filter: Filter = FILTERS.some(([k]) => k === loc) ? (loc as Filter) : "toi";
  const { groups, unread, total } = await listPublished(user, filter);

  return (
    <div className="flex flex-col gap-4">
      <nav
        aria-label="Lọc văn bản ban hành"
        className="inline-flex w-fit flex-wrap rounded-lg bg-muted p-1"
      >
        {FILTERS.map(([key, text]) => (
          <Link
            key={key}
            href={key === "toi" ? "/van-ban/ban-hanh" : `/van-ban/ban-hanh?loc=${key}`}
            aria-current={filter === key ? "page" : undefined}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-md px-3 font-medium",
              filter === key
                ? "bg-card text-brand shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {text}
            {key === "chua-xem" && unread > 0 && (
              <span className="rounded-full bg-accent-red px-2 text-sm leading-6 text-white tabular-nums">
                {unread}
              </span>
            )}
          </Link>
        ))}
      </nav>

      {total === 0 ? (
        <EmptyState
          icon={Inbox}
          title={
            filter === "chua-xem"
              ? "Bạn đã xem hết văn bản được gửi đến"
              : "Chưa có văn bản ban hành nào"
          }
          description="Văn thư / lãnh đạo bấm “Ban hành / Gửi” trên trang văn bản để gửi tới đơn vị, cá nhân hoặc toàn phường."
        />
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((g) => (
            <section key={g.day} aria-label={`Ngày ${g.label}`}>
              <h2 className="mb-2 flex items-center justify-between rounded-lg bg-muted px-4 py-2">
                <span className="font-bold text-muted-foreground">{g.label}</span>
                <span className="text-sm text-muted-foreground">{g.relative}</span>
              </h2>
              <ul className="flex flex-col gap-2">
                {g.items.map((d) => (
                  <li key={d.id}>
                    <Link
                      href={`/van-ban/${d.id}`}
                      className={cn(
                        "group flex items-start gap-4 rounded-xl border bg-card p-4 transition hover:border-brand/50 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                        d.toMe && !d.viewed && "border-brand/40 bg-brand-soft/30",
                      )}
                    >
                      <span
                        aria-hidden
                        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand"
                      >
                        <Send className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block leading-snug">
                          <strong className="uppercase">{d.sender}</strong>{" "}
                          <span className="text-muted-foreground">đã ban hành văn bản</span>{" "}
                          <strong>{documentHeadline(d.typeName, d.title)}</strong>
                          {d.number && <span className="font-medium"> [{d.number}]</span>}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
                          <span className="tabular-nums">{formatDateTime(d.publishedAt)}</span>
                          {d.attachmentCount > 0 && (
                            <span className="inline-flex items-center gap-1">
                              <Paperclip className="size-3.5" aria-hidden />
                              {d.attachmentCount} tệp
                            </span>
                          )}
                          {!d.toMe && <span>Không gửi trực tiếp cho bạn</span>}
                        </span>
                      </span>
                      {d.toMe && !d.viewed && (
                        <span className="mt-1 flex shrink-0 items-center gap-1.5 text-sm font-medium text-brand">
                          <span className="size-2.5 rounded-full bg-brand" aria-hidden />
                          <span className="sr-only sm:not-sr-only">Chưa xem</span>
                        </span>
                      )}
                      <ChevronRight
                        className="mt-3 size-5 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
