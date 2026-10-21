"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { RotateCcw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataTable } from "@/components/common/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { restoreDocument } from "@/server/actions/documents";
import { purgeAttachmentNow, purgeDocumentNow, restoreAttachment } from "@/server/actions/trash";

export type TrashDocumentRow = {
  id: string;
  number: string | null;
  title: string;
  typeName: string;
  typeColor: string;
  trail: string;
  branchCount: number;
  attachmentCount: number;
  requirementCount: number;
  deletedAt: string;
  deletedBy: string | null;
  purgeOn: string;
  daysLeft: number;
  parentDeleted: boolean;
};

export type TrashAttachmentRow = {
  id: string;
  fileName: string;
  size: string;
  documentId: string;
  documentLabel: string;
  deletedAt: string;
  deletedBy: string | null;
  purgeOn: string;
  daysLeft: number;
};

type Pending =
  | { kind: "document"; row: TrashDocumentRow }
  | { kind: "attachment"; row: TrashAttachmentRow }
  | null;

function DaysLeft({ days, on }: { days: number; on: string }) {
  return (
    <span className="flex flex-col">
      <span className={cn("font-medium", days <= 3 && "text-status-overdue")}>
        {days === 0 ? "Xoá trong đêm nay" : `Còn ${days} ngày`}
      </span>
      <span className="text-sm text-muted-foreground">tự xoá sau {on}</span>
    </span>
  );
}

const deletedCell = (r: { deletedAt: string; deletedBy: string | null }) => (
  <span className="flex flex-col">
    <span className="tabular-nums">{r.deletedAt}</span>
    <span className="text-sm text-muted-foreground">{r.deletedBy ?? "—"}</span>
  </span>
);

/** Hậu quả khi xoá vĩnh viễn một nhánh (Mục 8.2.10) */
function consequence(r: TrashDocumentRow): string {
  const parts = [r.branchCount > 1 ? `${r.branchCount} văn bản (gồm văn bản con)` : "1 văn bản"];
  if (r.attachmentCount) parts.push(`${r.attachmentCount} tệp đính kèm`);
  if (r.requirementCount)
    parts.push(`${r.requirementCount} yêu cầu báo cáo cùng các kỳ và bản nộp`);
  return parts.join(", ");
}

export function TrashTable({
  documents,
  attachments,
}: {
  documents: TrashDocumentRow[];
  attachments: TrashAttachmentRow[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"documents" | "attachments">("documents");
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const docColumns = useMemo<ColumnDef<TrashDocumentRow, unknown>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Văn bản",
        meta: { hideOnCard: true },
        cell: ({ row: { original: r } }) => (
          <span className="flex flex-col gap-1">
            <span className="flex flex-wrap items-center gap-2">
              <Badge style={{ backgroundColor: r.typeColor }} className="text-white">
                {r.typeName}
              </Badge>
              {r.number && <strong>{r.number}</strong>}
            </span>
            <span>{r.title}</span>
            {r.branchCount > 1 && (
              <span className="text-sm text-muted-foreground">
                Cả nhánh {r.branchCount} văn bản
                {r.attachmentCount ? ` · ${r.attachmentCount} tệp` : ""}
              </span>
            )}
          </span>
        ),
      },
      {
        accessorKey: "trail",
        header: "Nằm trong",
        cell: ({ getValue }) => (getValue() as string) || "— (chương trình)",
      },
      {
        id: "deleted",
        accessorFn: (r) => r.deletedAt,
        header: "Xoá lúc / người xoá",
        cell: ({ row }) => deletedCell(row.original),
      },
      {
        accessorKey: "daysLeft",
        header: "Thời hạn",
        cell: ({ row }) => <DaysLeft days={row.original.daysLeft} on={row.original.purgeOn} />,
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        meta: { label: "" },
        cell: ({ row: { original: r } }) => (
          <span className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={busy === r.id || r.parentDeleted}
              title={
                r.parentDeleted
                  ? "Văn bản cha cũng đang ở Thùng rác — khôi phục văn bản cha trước"
                  : undefined
              }
              onClick={async () => {
                setBusy(r.id);
                const res = await restoreDocument({ id: r.id });
                setBusy(null);
                if (!res.ok) return void toast.error(res.error.message);
                toast.success(`Đã khôi phục ${res.data.count} văn bản.`);
                router.refresh();
              }}
            >
              <RotateCcw aria-hidden />
              Khôi phục
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setPending({ kind: "document", row: r })}
            >
              <Trash2 aria-hidden />
              Xoá vĩnh viễn
            </Button>
          </span>
        ),
      },
    ],
    [busy, router],
  );

  const fileColumns = useMemo<ColumnDef<TrashAttachmentRow, unknown>[]>(
    () => [
      {
        accessorKey: "fileName",
        header: "Tệp",
        cell: ({ row: { original: r } }) => (
          <span className="flex flex-col">
            <span className="font-medium break-all">{r.fileName}</span>
            <span className="text-sm text-muted-foreground">{r.size}</span>
          </span>
        ),
      },
      {
        accessorKey: "documentLabel",
        header: "Thuộc văn bản",
        cell: ({ row: { original: r } }) => (
          <Link href={`/van-ban/${r.documentId}`} className="text-brand hover:underline">
            {r.documentLabel}
          </Link>
        ),
      },
      {
        id: "deleted",
        accessorFn: (r) => r.deletedAt,
        header: "Xoá lúc / người xoá",
        cell: ({ row }) => deletedCell(row.original),
      },
      {
        accessorKey: "daysLeft",
        header: "Thời hạn",
        cell: ({ row }) => <DaysLeft days={row.original.daysLeft} on={row.original.purgeOn} />,
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        meta: { label: "" },
        cell: ({ row: { original: r } }) => (
          <span className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={busy === r.id}
              onClick={async () => {
                setBusy(r.id);
                const res = await restoreAttachment({ id: r.id });
                setBusy(null);
                if (!res.ok) return void toast.error(res.error.message);
                toast.success(`Đã khôi phục tệp “${r.fileName}”.`);
                router.refresh();
              }}
            >
              <RotateCcw aria-hidden />
              Khôi phục
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setPending({ kind: "attachment", row: r })}
            >
              <Trash2 aria-hidden />
              Xoá vĩnh viễn
            </Button>
          </span>
        ),
      },
    ],
    [busy, router],
  );

  return (
    <div className="flex flex-col gap-3">
      <div
        className="inline-flex w-fit flex-wrap rounded-lg bg-muted p-1"
        role="group"
        aria-label="Loại mục"
      >
        {(
          [
            ["documents", `Văn bản (${documents.length})`],
            ["attachments", `Tệp đính kèm (${attachments.length})`],
          ] as const
        ).map(([key, text]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            aria-pressed={tab === key}
            className={cn(
              "h-10 rounded-md px-3 font-medium",
              tab === key ? "bg-card text-brand shadow-sm" : "text-muted-foreground",
            )}
          >
            {text}
          </button>
        ))}
      </div>

      {tab === "documents" ? (
        <DataTable
          columns={docColumns}
          data={documents}
          searchText={(r) => `${r.number ?? ""} ${r.typeName} ${r.title} ${r.trail}`}
          searchPlaceholder="Tìm trong Thùng rác…"
          emptyMessage="Thùng rác không có văn bản nào."
          cardTitle={(r) => (r.number ? `${r.number} – ${r.title}` : r.title)}
        />
      ) : (
        <DataTable
          columns={fileColumns}
          data={attachments}
          searchText={(r) => `${r.fileName} ${r.documentLabel}`}
          searchPlaceholder="Tìm tệp…"
          emptyMessage="Thùng rác không có tệp nào."
          cardTitle={(r) => r.fileName}
        />
      )}

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(o) => !o && setPending(null)}
        title="Xoá vĩnh viễn?"
        destructive
        confirmLabel="Xoá vĩnh viễn"
        description={
          pending?.kind === "document" ? (
            <>
              <strong>{pending.row.number ?? pending.row.title}</strong> sẽ bị xoá hẳn khỏi hệ
              thống: {consequence(pending.row)}. <strong>Không khôi phục được.</strong> Công việc
              giao từ văn bản vẫn giữ lại nhưng không còn gắn với văn bản.
            </>
          ) : pending?.kind === "attachment" ? (
            <>
              Tệp <strong>{pending.row.fileName}</strong> sẽ bị xoá hẳn khỏi máy chủ.{" "}
              <strong>Không khôi phục được.</strong>
            </>
          ) : null
        }
        successMessage="Đã xoá vĩnh viễn."
        onConfirm={() =>
          pending?.kind === "document"
            ? purgeDocumentNow({ id: pending.row.id })
            : purgeAttachmentNow({ id: pending!.row.id })
        }
        onSuccess={() => {
          setPending(null);
          router.refresh();
        }}
      />
    </div>
  );
}
