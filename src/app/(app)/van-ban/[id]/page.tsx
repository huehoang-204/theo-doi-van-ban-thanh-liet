import type { Metadata } from "next";
import { Lock } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Fragment } from "react";

import { EmptyState } from "@/components/common/EmptyState";
import { DocumentActions } from "@/components/document-tree/DocumentActions";
import { FilesTab } from "@/components/document-tree/FilesTab";
import { CommentsSection } from "@/components/document-tree/CommentsSection";
import { DocumentSidebar } from "@/components/document-tree/DocumentSidebar";
import { PublishButton } from "@/components/document-tree/PublishDialog";
import {
  AssignTaskButton,
  DocumentReportsTab,
  DocumentTasksTab,
} from "@/components/document-tree/DocumentWorkTabs";
import { toTaskRow } from "@/server/tasks/rows";
import { TypeIcon } from "@/components/document-tree/type-icon";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { actionLabel } from "@/lib/audit-labels";
import { formatDate, formatDateTime } from "@/lib/format";
import { can } from "@/lib/permissions";
import { URGENCY_LABELS, VALIDITY_LABELS } from "@/lib/schemas/document";
import { canAddChild } from "@/lib/tree";
import { requirePermission } from "@/server/auth/current-user";
import { documentHistory, getDocumentDetail, getMaxTreeDepth } from "@/server/documents/queries";
import { db } from "@/lib/db";
import { catalogOptions } from "@/server/queries/catalog";
import { requirementsOfDocument } from "@/server/reports/queries";
import { documentSocial, recordDocumentView } from "@/server/documents/social";
import { listTasks, userOptions } from "@/server/tasks/queries";

export const metadata: Metadata = { title: "Chi tiết văn bản" };

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
  const canAssign = can(user, "task.assign");
  const canRequire = can(user, "report.createRequirement");
  const canEdit = can(user, "document.update", resource);
  // Ghi "đã xem" trước khi đọc danh sách người đã xem (GĐ5b)
  await recordDocumentView(user, doc.id);
  const [
    maxDepth,
    history,
    departments,
    tasks,
    requirements,
    options,
    users,
    agencies,
    social,
    publishOptions,
  ] = await Promise.all([
    getMaxTreeDepth(),
    documentHistory(doc.id),
    db.department.findMany({
      where: { id: { in: doc.coDepartmentIds } },
      select: { name: true },
    }),
    listTasks(user, { documentId: doc.id }),
    requirementsOfDocument(user, doc.id),
    canAssign || canRequire ? catalogOptions() : null,
    canAssign || canRequire ? userOptions() : null,
    canRequire
      ? db.issuingAgency.findMany({
          where: { active: true },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : [],
    documentSocial(user, doc.id),
    canEdit
      ? Promise.all([
          db.department.findMany({
            where: { active: true },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
            select: { id: true, name: true },
          }),
          userOptions(),
        ]).then(([d, u]) => ({
          departments: d.map((x) => ({ value: x.id, label: x.name })),
          users: u,
        }))
      : null,
  ]);
  const taskOptions = options && users ? { departments: options.departments, users } : null;
  const docRef = { id: doc.id, label: label(doc) };
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
          {doc.progressCache !== null && (
            <Badge variant="outline">Tiến độ {doc.progressCache}%</Badge>
          )}
          {social.published && (
            <Badge className="bg-brand-soft text-brand">
              Đã ban hành {formatDateTime(social.published.at)}
            </Badge>
          )}
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
        {((canAssign && taskOptions) || publishOptions) && (
          <div className="flex flex-wrap gap-2">
            {publishOptions && (
              <PublishButton
                documentId={doc.id}
                documentLabel={label(doc)}
                published={!!social.published}
                alreadyIds={doc.shares.map((s) => s.userId)}
                currentUserId={user.id}
                options={publishOptions}
              />
            )}
            {canAssign && taskOptions && (
              <AssignTaskButton document={docRef} options={taskOptions} />
            )}
          </div>
        )}
      </header>

      {/* ≥ 1536px: nội dung + cột thông tin bên phải; nhỏ hơn: cột thông tin xuống cuối trang */}
      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-6">
          {social.published?.message && (
            <section
              aria-label="Lời gửi kèm"
              className="rounded-xl border bg-card p-4 leading-relaxed break-words whitespace-pre-wrap"
            >
              {social.published.message}
            </section>
          )}

          <section aria-labelledby="tep-dinh-kem">
            <h3 id="tep-dinh-kem" className="mb-3 text-lg font-bold">
              Tệp tin đính kèm ({doc.attachments.length})
            </h3>
            <FilesTab
              documentId={doc.id}
              canEdit={canEdit}
              inline
              files={doc.attachments.map((a) => ({
                id: a.id,
                fileName: a.fileName,
                mimeType: a.mimeType,
                sizeBytes: a.sizeBytes,
                uploadedBy: a.uploadedBy.fullName,
                createdAt: formatDateTime(a.createdAt),
              }))}
            />
          </section>

          <Tabs defaultValue="thong-tin">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="thong-tin" className="flex-none">
                Thông tin
              </TabsTrigger>
              <TabsTrigger value="cong-viec" className="flex-none">
                Công việc ({tasks.length})
              </TabsTrigger>
              <TabsTrigger value="bao-cao" className="flex-none">
                Báo cáo ({requirements.length})
              </TabsTrigger>
              <TabsTrigger value="lich-su" className="flex-none">
                Lịch sử
              </TabsTrigger>
            </TabsList>

            <TabsContent value="thong-tin" className="pt-3">
              <dl>
                <Row label="Loại văn bản">{doc.type.name}</Row>
                <Row label="Số, ký hiệu">{doc.number}</Row>
                <Row label="Cơ quan ban hành">
                  {doc.issuingAgency?.name ?? doc.issuingAgencyText}
                </Row>
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
                    <div
                      className="prose-summary"
                      dangerouslySetInnerHTML={{ __html: doc.summary }}
                    />
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

            <TabsContent value="cong-viec" className="pt-3">
              <DocumentTasksTab
                tasks={tasks.map(toTaskRow)}
                assign={
                  canAssign && taskOptions ? { document: docRef, options: taskOptions } : null
                }
              />
            </TabsContent>

            <TabsContent value="bao-cao" className="pt-3">
              <DocumentReportsTab
                documentId={doc.id}
                options={
                  canRequire && taskOptions
                    ? {
                        ...taskOptions,
                        agencies: agencies.map((a) => ({ value: a.id, label: a.name })),
                      }
                    : null
                }
                requirements={requirements.map((r) => ({
                  id: r.id,
                  name: r.name,
                  frequency: r.frequency,
                  onceDueDate: r.onceDueDate,
                  dueDayOfPeriod: r.dueDayOfPeriod,
                  dueMonthOffset: r.dueMonthOffset,
                  startDate: r.startDate,
                  endDate: r.endDate,
                  recipientAgencyId: r.recipientAgencyId,
                  departmentIds: r.departmentIds,
                  followerUserId: r.followerUserId,
                  autoCreateChild: r.autoCreateChild,
                  active: r.active,
                  recipient: r.recipientAgency?.name ?? null,
                  follower: r.followerUser?.fullName ?? null,
                  departmentNames: r.departmentNames,
                  stats: r.stats,
                  upcoming: r.upcoming.map((p) => ({
                    id: p.id,
                    label: p.label,
                    department: p.department.name,
                    dueDate: formatDate(p.dueDate),
                    daysLeft: p.daysLeft,
                    status: p.status,
                    canSubmit: p.canSubmit,
                  })),
                }))}
              />
            </TabsContent>

            <TabsContent value="lich-su" className="pt-3">
              {can(user, "auditLog.view") && (
                <p className="mb-3">
                  <Link
                    href={`/quan-tri/nhat-ky?doiTuong=DocumentNode&ma=${doc.id}`}
                    className="text-brand underline-offset-4 hover:underline"
                  >
                    Xem đầy đủ trong Nhật ký (kèm nội dung thay đổi)
                  </Link>
                </p>
              )}
              {history.length === 0 ? (
                <p className="text-muted-foreground">Chưa có lịch sử.</p>
              ) : (
                <ol className="flex flex-col gap-2">
                  {history.map((h) => (
                    <li
                      key={h.id}
                      className="flex flex-wrap gap-x-3 border-l-2 border-brand-soft pl-3"
                    >
                      <span className="text-muted-foreground tabular-nums">
                        {formatDateTime(h.createdAt)}
                      </span>
                      <span className="font-medium">{h.user?.fullName ?? "Hệ thống"}</span>
                      <span>
                        {actionLabel(h.action)}
                        {h.entity === "Attachment" &&
                          ` tệp “${String((h.after as { fileName?: string } | null)?.fileName ?? (h.before as { fileName?: string } | null)?.fileName ?? "")}”`}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </TabsContent>
          </Tabs>

          <CommentsSection
            documentId={doc.id}
            comments={social.comments.map((c) => ({
              id: c.id,
              content: c.content,
              createdAt: c.createdAt.toISOString(),
              author: { id: c.author.id, fullName: c.author.fullName, detail: c.author.detail },
              mine: c.mine,
              canDelete: c.mine || user.roles.includes("ADMIN"),
              attachments: c.attachments,
            }))}
          />
        </div>

        <DocumentSidebar
          docId={doc.id}
          social={social}
          doc={{
            typeName: doc.type.name,
            agency: doc.issuingAgency?.name ?? doc.issuingAgencyText,
            issuedDate: doc.issuedDate,
            effectiveDate: doc.effectiveDate,
            dueDate: doc.dueDate,
            createdBy: doc.createdBy.fullName,
            createdAt: doc.createdAt,
          }}
        />
      </div>
    </article>
  );
}
