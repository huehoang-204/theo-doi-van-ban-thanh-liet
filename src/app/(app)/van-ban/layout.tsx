import { PageHeader } from "@/components/common/PageHeader";
import { DocumentWorkspace } from "@/components/document-tree/DocumentWorkspace";
import { TreeProvider } from "@/components/document-tree/TreeContext";
import { DocumentsHeaderActions } from "@/components/document-tree/ViewSwitch";
import { db } from "@/lib/db";
import { vi } from "@/lib/i18n/vi";
import { can } from "@/lib/permissions";
import { requirePermission } from "@/server/auth/current-user";
import { getMaxTreeDepth, listChildren } from "@/server/documents/queries";

/** Layout giữ nguyên khi chuyển giữa các văn bản → cây không bị tải lại / mất trạng thái mở nhánh */
export default async function DocumentsLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePermission("document.list");
  const [roots, maxDepth, types, fields, agencies, departments] = await Promise.all([
    listChildren(user, null),
    getMaxTreeDepth(),
    db.documentType.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    db.field.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    db.issuingAgency.findMany({
      where: { active: true },
      orderBy: [{ level: "asc" }, { name: "asc" }],
    }),
    db.department.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);
  const opt = (rows: { id: string; name: string }[]) =>
    rows.map((r) => ({ value: r.id, label: r.name }));
  const canCreate = can(user, "document.create");

  return (
    <TreeProvider
      initialRoots={roots}
      maxDepth={maxDepth}
      options={{
        types: types.map((t) => ({ id: t.id, code: t.code, name: t.name, isProgram: t.isProgram })),
        fields: opt(fields),
        agencies: opt(agencies),
        departments: opt(departments),
      }}
      permissions={{
        canCreate,
        // PARTY_ADMIN chỉ tạo văn bản lĩnh vực XD Đảng — máy chủ kiểm tra theo lĩnh vực
        canCreateProgram: canCreate,
        canEdit: can(user, "document.update"),
        canDelete: can(user, "document.delete"),
      }}
    >
      <PageHeader
        title={vi.nav.documents}
        description="Văn bản theo cây tối đa 5 cấp: Chương trình › Kế hoạch › Quyết định › Văn bản kèm theo › Báo cáo."
        action={<DocumentsHeaderActions />}
      />
      <DocumentWorkspace>{children}</DocumentWorkspace>
    </TreeProvider>
  );
}
