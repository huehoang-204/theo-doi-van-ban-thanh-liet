import type { Metadata } from "next";

import {
  DocumentListTable,
  type DocumentListRow,
} from "@/components/document-tree/DocumentListTable";
import { formatDate, formatDateTime } from "@/lib/format";
import { flattenTree } from "@/lib/party";
import { can } from "@/lib/permissions";
import { requirePermission } from "@/server/auth/current-user";
import { documentResourceOf, listDocumentsFlat } from "@/server/documents/queries";

export const metadata: Metadata = { title: "Văn bản — dạng danh sách" };

export default async function DocumentListPage() {
  const user = await requirePermission("document.list");
  const [active, deleted] = await Promise.all([
    listDocumentsFlat(user),
    listDocumentsFlat(user, { deleted: true }),
  ]);
  const programs = active.filter((d) => d.depth === 1);
  const programTitle = new Map(programs.map((p) => [p.id, p.title]));

  const toRow = (d: (typeof active)[number]): DocumentListRow => ({
    id: d.id,
    depth: d.depth,
    rootId: d.rootId,
    programTitle: programTitle.get(d.rootId ?? d.id) ?? "—",
    typeId: d.typeId,
    typeName: d.type.name,
    typeColor: d.type.color,
    number: d.number,
    title: d.title,
    agency: d.issuingAgency?.name ?? d.issuingAgencyText,
    issuedDate: formatDate(d.issuedDate),
    issuedSort: d.issuedDate?.toISOString() ?? "",
    fieldId: d.fieldId,
    fieldName: d.field?.name ?? null,
    validity: d.validity,
    deletedAt: d.deletedAt ? formatDateTime(d.deletedAt) : null,
    canRestore: can(user, "document.delete", documentResourceOf(d)),
  });

  // Thùng rác: chỉ hiện nút "gốc" của mỗi lần xoá (khôi phục nó sẽ khôi phục cả nhánh xoá cùng lúc)
  const deletedIds = new Set(deleted.map((d) => d.id));
  const deletedRoots = deleted.filter(
    (d) =>
      !d.parentId ||
      !deletedIds.has(d.parentId) ||
      deleted.find((p) => p.id === d.parentId)?.deletedAt?.getTime() !== d.deletedAt?.getTime(),
  );

  return (
    <DocumentListTable
      rows={flattenTree(
        active,
        (a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, "vi"),
      ).map(toRow)}
      deletedRows={deletedRoots.map(toRow)}
      programs={programs.map((p) => ({ id: p.id, title: p.title }))}
    />
  );
}
