import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, History } from "lucide-react";

import { AuditFilters } from "@/components/admin/AuditFilters";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import {
  actionLabel,
  auditDetails,
  auditEntityHref,
  auditSubject,
  entityLabel,
} from "@/lib/audit-labels";
import { formatDateTime, formatNumber } from "@/lib/format";
import { vi } from "@/lib/i18n/vi";
import { cn } from "@/lib/utils";
import {
  auditFilterOptions,
  listAuditLogs,
  parseAuditFilters,
  SYSTEM_ACTOR,
  type AuditRow,
} from "@/server/audit/queries";
import { requirePermission } from "@/server/auth/current-user";

export const metadata: Metadata = { title: vi.nav.auditLog };

const DANGER = new Set(["DELETE", "PURGE", "LOGIN_FAILED"]);

function Details({ row }: { row: AuditRow }) {
  const details = auditDetails(row.before, row.after);
  if (details.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <details className="group">
      <summary className="cursor-pointer text-brand underline-offset-2 hover:underline">
        {details.length} mục
      </summary>
      <dl className="mt-2 grid gap-1 text-sm">
        {details.map((d) => (
          <div key={d.field} className="grid grid-cols-[minmax(7rem,auto)_1fr] gap-2">
            <dt className="text-muted-foreground">{d.label}</dt>
            <dd className="break-words">
              {d.before !== undefined ? (
                <>
                  <span className="text-muted-foreground line-through">{d.before}</span> →{" "}
                  <span className="font-medium">{d.after}</span>
                </>
              ) : (
                d.after
              )}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

function Subject({ row }: { row: AuditRow }) {
  const name = auditSubject(row.before, row.after);
  const href = auditEntityHref(row.entity, row.entityId, row.action);
  return (
    <span className="flex flex-col">
      <span>{entityLabel(row.entity)}</span>
      {name &&
        (href ? (
          <Link href={href} className="text-sm text-brand hover:underline">
            {name}
          </Link>
        ) : (
          <span className="text-sm text-muted-foreground">{name}</span>
        ))}
    </span>
  );
}

const actor = (row: AuditRow) =>
  row.user ? (
    <span className="flex flex-col">
      <span>{row.user.fullName}</span>
      <span className="text-sm text-muted-foreground">{row.user.username}</span>
    </span>
  ) : (
    <span className="text-muted-foreground">Hệ thống (tự động)</span>
  );

const ActionBadge = ({ action }: { action: string }) => (
  <span
    className={cn(
      "inline-flex rounded-md px-2 py-0.5 text-sm font-medium",
      DANGER.has(action)
        ? "bg-red-50 text-status-overdue dark:bg-red-950/40"
        : "bg-muted text-foreground",
    )}
  >
    {actionLabel(action)}
  </span>
);

/** Nhật ký hệ thống (Mục 13.2): ADMIN và LEADER xem; lọc theo người / đối tượng / ngày */
export default async function AuditLogPage({ searchParams }: PageProps<"/quan-tri/nhat-ky">) {
  await requirePermission("auditLog.view");
  const params = await searchParams;
  const filters = parseAuditFilters((k) => params[k]);
  const [{ rows, total, pageCount }, options] = await Promise.all([
    listAuditLogs(filters),
    auditFilterOptions(),
  ]);

  const values = {
    nguoi: filters.userId ?? "",
    doiTuong: filters.entity ?? "",
    ma: filters.entityId ?? "",
    hanhDong: filters.action ?? "",
    tu: filters.from ?? "",
    den: filters.to ?? "",
  };
  const pageHref = (page: number) => {
    const q = new URLSearchParams(Object.entries(values).filter(([, v]) => v));
    if (page > 1) q.set("trang", String(page));
    const s = q.toString();
    return (s ? `/quan-tri/nhat-ky?${s}` : "/quan-tri/nhat-ky") as never;
  };
  const subjectOfFilter =
    filters.entityId && rows[0] ? auditSubject(rows[0].before, rows[0].after) : null;

  return (
    <>
      <PageHeader
        title={vi.nav.auditLog}
        description="Mọi thao tác ghi, đăng nhập, tải tệp, xuất dữ liệu và việc xoá vĩnh viễn của hệ thống. Nhật ký không sửa, không xoá được."
      />
      <AuditFilters
        values={values}
        entityIdLabel={filters.entityId ? (subjectOfFilter ?? filters.entityId) : null}
        users={[
          { value: SYSTEM_ACTOR, label: "Hệ thống (tự động)" },
          ...options.users.map((u) => ({ value: u.id, label: `${u.fullName} (${u.username})` })),
        ]}
        entities={options.entities
          .map((e) => ({ value: e, label: entityLabel(e) }))
          .sort((a, b) => a.label.localeCompare(b.label, "vi"))}
        actions={options.actions
          .map((a) => ({ value: a, label: actionLabel(a) }))
          .sort((a, b) => a.label.localeCompare(b.label, "vi"))}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={History}
          title="Không có bản ghi nào"
          description="Thử bỏ bớt điều kiện lọc hoặc mở rộng khoảng ngày."
        />
      ) : (
        <>
          {/* ≥ 768px: bảng; nhỏ hơn: thẻ */}
          <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
            <table className="w-full text-table">
              <thead className="bg-muted/60 text-left text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium whitespace-nowrap">
                    Thời gian
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Người thực hiện
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Hành động
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Đối tượng
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Chi tiết
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Địa chỉ IP
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t align-top">
                    <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                      {formatDateTime(r.createdAt)}
                    </td>
                    <td className="px-3 py-2">{actor(r)}</td>
                    <td className="px-3 py-2">
                      <ActionBadge action={r.action} />
                    </td>
                    <td className="max-w-80 px-3 py-2">
                      <Subject row={r} />
                    </td>
                    <td className="max-w-96 px-3 py-2">
                      <Details row={r} />
                    </td>
                    <td className="px-3 py-2 text-sm text-muted-foreground tabular-nums">
                      {r.ip ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="flex flex-col gap-3 md:hidden" aria-label="Nhật ký">
            {rows.map((r) => (
              <li key={r.id} className="rounded-xl border bg-card p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <ActionBadge action={r.action} />
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {formatDateTime(r.createdAt)}
                  </span>
                </div>
                <div className="grid gap-2">
                  <Subject row={r} />
                  <div className="text-sm">{actor(r)}</div>
                  <Details row={r} />
                </div>
              </li>
            ))}
          </ul>

          <nav
            className="mt-4 flex flex-wrap items-center justify-between gap-3 text-muted-foreground"
            aria-label="Phân trang"
          >
            <span>
              {formatNumber(total)} bản ghi · Trang {filters.page}/{pageCount}
            </span>
            <span className="flex gap-2">
              {filters.page > 1 && (
                <Button variant="outline" asChild>
                  <Link href={pageHref(filters.page - 1)}>
                    <ChevronLeft aria-hidden />
                    Trang trước
                  </Link>
                </Button>
              )}
              {filters.page < pageCount && (
                <Button variant="outline" asChild>
                  <Link href={pageHref(filters.page + 1)}>
                    Trang sau
                    <ChevronRight aria-hidden />
                  </Link>
                </Button>
              )}
            </span>
          </nav>
        </>
      )}
    </>
  );
}
