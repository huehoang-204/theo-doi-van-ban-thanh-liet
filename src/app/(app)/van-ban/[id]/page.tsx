import type { Metadata } from "next";
import { Lock } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Fragment } from "react";

import { EmptyState } from "@/components/common/EmptyState";
import { DocumentActions } from "@/components/document-tree/DocumentActions";
import { FilesTab } from "@/components/document-tree/FilesTab";
import { TypeIcon } from "@/components/document-tree/type-icon";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, formatDateTime } from "@/lib/format";
import { can } from "@/lib/permissions";
import { URGENCY_LABELS, VALIDITY_LABELS } from "@/lib/schemas/document";
import { canAddChild } from "@/lib/tree";
import { requirePermission } from "@/server/auth/current-user";
import { documentHistory, getDocumentDetail, getMaxTreeDepth } from "@/server/documents/queries";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Chi tiết văn bản" };

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Tạo",
  UPDATE: "Sửa",
  MOVE: "Di chuyển",
  DELETE: "Xoá",
  RESTORE: "Khôi phục",
  DOWNLOAD: "Xem/tải tệp",
};

const FLOW_LABELS: Record<string, string> = {
  NEW: "Mới giao",
  IN_PROGRESS: "Đang thực hiện",
  SUBMITTED: "Chờ duyệt",
  DONE: "Hoàn thành",
  CANCELLED: "Đã huỷ",
};

const FREQUENCY_LABELS: Record<string, string> = {
  ONCE: "Một lần",
  MONTHLY: "Hằng tháng",
  QUARTERLY: "Hằng quý",
  HALF_YEAR: "6 tháng",
  YEARLY: "Hằng năm",
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b py-2.5 last:border-b-0 sm:grid-cols-[13rem_1fr]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">
        {children || <span className="text-muted-foreground">—</span>}
      </dd>
    </div>
  );
}

const label = (d: { number: string | null; title: string }) =>
  d.number ? `${d.number} – ${d.title}` : d.title;

export default async function DocumentDetailPage({ params }: PageProps<"/van-ban/[id]">) {
  const user = await requirePermission("document.list");
  const { id } = await params;
  const result = await getDocumentDetail(user, id);
  if (result.status === "not-found") notFound();
  if (result.status === "forbidden") {
    return (
      <EmptyState
        icon={Lock}
        title="Bạn không có quyền xem chi tiết văn bản này"
        description={`“${label(result.node)}” hiện trên cây để giữ cấu trúc vì có văn bản con bạn được xem. Mở nhánh bên trái để xem các văn bản đó.`}
        className="border-0"
      />
    );
  }

  const { doc, ancestors, resource } = result;
  const [maxDepth, history, departments] = await Promise.all([
    getMaxTreeDepth(),
    documentHistory(doc.id),
    db.department.findMany({ where: { id: { in: doc.coDepartmentIds } }, select: { name: true } }),
  ]);
  const canEdit = can(user, "document.update", resource);
  const canDelete = can(user, "document.delete", resource);
  const canChild = can(user, "document.create") && canAddChild(doc.depth, maxDepth);

  return (
    <article className="flex flex-col gap-4">
      {/* Đường dẫn: bấm được từng cấp (Mục 4.4) */}
      <nav
        aria-label="Vị trí trong cây"
        className="flex flex-wrap items-center gap-1 text-[0.9375rem] text-muted-foreground"
      >
        {ancestors.map((a) => (
          <Fragment key={a.id}>
            <Link
              href={`/van-ban/${a.id}`}
              className="max-w-64 truncate text-brand underline-offset-4 hover:underline"
            >
              {a.number ?? a.title}
            </Link>
            <span aria-hidden>›</span>
          </Fragment>
        ))}
        <span aria-current="page" className="max-w-64 truncate font-medium text-foreground">
          {doc.number ?? doc.title}
        </span>
      </nav>

      <header className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <TypeIcon icon={doc.type.icon} color={doc.type.color} className="mt-1 size-7 shrink-0" />
          <div className="min-w-0">
            <p className="text-muted-foreground">
              {doc.type.name} · cấp {doc.depth}
              {doc.number && <strong className="ml-2 text-foreground">{doc.number}</strong>}
            </p>
            <h2 className="text-page-title leading-snug font-bold">{doc.title}</h2>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            className={
              doc.validity === "ACTIVE"
                ? "bg-status-done/15 text-status-done-late"
                : "bg-slate-200 text-slate-700"
            }
          >
            {VALIDITY_LABELS[doc.validity]}
          </Badge>
          {doc.urgency !== "NORMAL" && (
            <Badge className="bg-accent-red/10 text-accent-red">
              {URGENCY_LABELS[doc.urgency]}
            </Badge>
          )}
          {doc.isInternalPublic && <Badge variant="outline">Công khai nội bộ</Badge>}
          {doc.progressCache > 0 && <Badge variant="outline">Tiến độ {doc.progressCache}%</Badge>}
        </div>
        <DocumentActions
          node={{
            id: doc.id,
            parentId: doc.parentId,
            path: doc.path,
            depth: doc.depth,
            label: label(doc),
            isProgram: doc.type.isProgram,
          }}
          doc={{
            id: doc.id,
            parentId: doc.parentId,
            depth: doc.depth,
            typeId: doc.typeId,
            number: doc.number,
            title: doc.title,
            issuingAgencyId: doc.issuingAgencyId,
            issuingAgencyText: doc.issuingAgencyText,
            signer: doc.signer,
            issuedDate: doc.issuedDate,
            effectiveDate: doc.effectiveDate,
            dueDate: doc.dueDate,
            fieldId: doc.fieldId,
            urgency: doc.urgency,
            validity: doc.validity,
            replacedBy: doc.replacedBy,
            leadDepartmentId: doc.leadDepartmentId,
            coDepartmentIds: doc.coDepartmentIds,
            summary: doc.summary,
            tags: doc.tags,
            isInternalPublic: doc.isInternalPublic,
          }}
          canEdit={canEdit}
          canDelete={canDelete}
          canAddChild={canChild}
        />
      </header>

      <Tabs defaultValue="thong-tin">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="thong-tin" className="flex-none">
            Thông tin
          </TabsTrigger>
          <TabsTrigger value="tep" className="flex-none">
            Tệp ({doc.attachments.length})
          </TabsTrigger>
          <TabsTrigger value="cong-viec" className="flex-none">
            Công việc ({doc.tasks.length})
          </TabsTrigger>
          <TabsTrigger value="bao-cao" className="flex-none">
            Báo cáo ({doc.reportRequirements.length})
          </TabsTrigger>
          <TabsTrigger value="lich-su" className="flex-none">
            Lịch sử
          </TabsTrigger>
        </TabsList>

        <TabsContent value="thong-tin" className="pt-3">
          <dl>
            <Row label="Loại văn bản">{doc.type.name}</Row>
            <Row label="Số, ký hiệu">{doc.number}</Row>
            <Row label="Cơ quan ban hành">{doc.issuingAgency?.name ?? doc.issuingAgencyText}</Row>
            <Row label="Người ký">{doc.signer}</Row>
            <Row label="Ngày ban hành">{formatDate(doc.issuedDate)}</Row>
            <Row label="Ngày hiệu lực">{formatDate(doc.effectiveDate)}</Row>
            <Row label="Hạn xử lý chung">{formatDate(doc.dueDate)}</Row>
            <Row label="Lĩnh vực">{doc.field?.name}</Row>
            <Row label="Độ khẩn">{URGENCY_LABELS[doc.urgency]}</Row>
            <Row label="Đơn vị chủ trì">{doc.leadDepartment?.name}</Row>
            <Row label="Đơn vị phối hợp">{departments.map((d) => d.name).join("; ")}</Row>
            <Row label="Trạng thái văn bản">
              {VALIDITY_LABELS[doc.validity]}
              {doc.replacedBy && (
                <>
                  {" — thay thế bởi "}
                  <Link
                    href={`/van-ban/${doc.replacedBy.id}`}
                    className="text-brand underline-offset-4 hover:underline"
                  >
                    {label(doc.replacedBy)}
                  </Link>
                </>
              )}
            </Row>
            {doc.replaces.length > 0 && (
              <Row label="Thay thế cho">
                {doc.replaces.map((r) => (
                  <Link
                    key={r.id}
                    href={`/van-ban/${r.id}`}
                    className="block text-brand underline-offset-4 hover:underline"
                  >
                    {label(r)}
                  </Link>
                ))}
              </Row>
            )}
            <Row label="Nội dung tóm tắt">
              {doc.summary && (
                <div className="prose-summary" dangerouslySetInnerHTML={{ __html: doc.summary }} />
              )}
            </Row>
            <Row label="Từ khoá / Thẻ">
              {doc.tags.length > 0 && (
                <span className="flex flex-wrap gap-1">
                  {doc.tags.map((t) => (
                    <Badge key={t} variant="secondary">
                      {t}
                    </Badge>
                  ))}
                </span>
              )}
            </Row>
            <Row label="Văn bản con">
              {doc._count.children > 0 ? `${doc._count.children} văn bản` : null}
            </Row>
            <Row label="Người tạo">
              {doc.createdBy.fullName} · {formatDateTime(doc.createdAt)}
            </Row>
            {doc.updatedBy && (
              <Row label="Cập nhật gần nhất">
                {doc.updatedBy.fullName} · {formatDateTime(doc.updatedAt)}
              </Row>
            )}
          </dl>
        </TabsContent>

        <TabsContent value="tep" className="pt-3">
          <FilesTab
            documentId={doc.id}
            canEdit={canEdit}
            files={doc.attachments.map((a) => ({
              id: a.id,
              fileName: a.fileName,
              mimeType: a.mimeType,
              sizeBytes: a.sizeBytes,
              uploadedBy: a.uploadedBy.fullName,
              createdAt: formatDateTime(a.createdAt),
            }))}
          />
        </TabsContent>

        <TabsContent value="cong-viec" className="pt-3">
          {doc.tasks.length === 0 ? (
            <p className="text-muted-foreground">Chưa có công việc nào giao từ văn bản này.</p>
          ) : (
            <ul className="flex flex-col divide-y rounded-xl border">
              {doc.tasks.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <p className="font-medium">{t.title}</p>
                    <p className="text-sm text-muted-foreground">
                      Chủ trì: {t.leadUser?.fullName ?? t.leadDepartment?.name ?? "—"} · Hạn:{" "}
                      {formatDate(t.dueDate) || "không đặt"}
                    </p>
                  </div>
                  <span className="text-sm">
                    {FLOW_LABELS[t.flow]} · {t.progress}%
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-sm text-muted-foreground">
            Giao việc, cập nhật tiến độ và duyệt hoàn thành sẽ có ở Giai đoạn 3.
          </p>
        </TabsContent>

        <TabsContent value="bao-cao" className="pt-3">
          {doc.reportRequirements.length === 0 ? (
            <p className="text-muted-foreground">Văn bản này không đặt yêu cầu báo cáo.</p>
          ) : (
            <ul className="flex flex-col divide-y rounded-xl border">
              {doc.reportRequirements.map((r) => (
                <li key={r.id} className="p-3">
                  <p className="font-medium">{r.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {FREQUENCY_LABELS[r.frequency]}
                    {r.dueDayOfPeriod ? `, hạn ngày ${r.dueDayOfPeriod}` : ""} ·{" "}
                    {formatDate(r.startDate)} – {formatDate(r.endDate) || "…"}
                    {r.recipientAgency && ` · Nơi nhận: ${r.recipientAgency.name}`}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-sm text-muted-foreground">
            Tạo yêu cầu báo cáo, sinh kỳ và nộp báo cáo sẽ có ở Giai đoạn 3.
          </p>
        </TabsContent>

        <TabsContent value="lich-su" className="pt-3">
          {history.length === 0 ? (
            <p className="text-muted-foreground">Chưa có lịch sử.</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {history.map((h) => (
                <li key={h.id} className="flex flex-wrap gap-x-3 border-l-2 border-brand-soft pl-3">
                  <span className="text-muted-foreground tabular-nums">
                    {formatDateTime(h.createdAt)}
                  </span>
                  <span className="font-medium">{h.user?.fullName ?? "Hệ thống"}</span>
                  <span>
                    {ACTION_LABELS[h.action] ?? h.action}
                    {h.entity === "Attachment" &&
                      ` tệp “${String((h.after as { fileName?: string } | null)?.fileName ?? (h.before as { fileName?: string } | null)?.fileName ?? "")}”`}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </TabsContent>
      </Tabs>
    </article>
  );
}
