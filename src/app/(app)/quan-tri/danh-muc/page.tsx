import type { Metadata } from "next";
import Link from "next/link";

import {
  AgenciesTable,
  DocumentTypesTable,
  FieldsTable,
  OldAreasTable,
} from "@/components/catalog/GeneralCatalogs";
import { PageHeader } from "@/components/common/PageHeader";
import { vi } from "@/lib/i18n/vi";
import { cn } from "@/lib/utils";
import { requirePermission } from "@/server/auth/current-user";
import {
  listDocumentTypes,
  listFields,
  listIssuingAgencies,
  listOldAreas,
} from "@/server/queries/catalog";

export const metadata: Metadata = { title: vi.nav.catalogs };

const TABS = [
  { key: "loai-van-ban", label: "Loại văn bản" },
  { key: "linh-vuc", label: "Lĩnh vực" },
  { key: "co-quan", label: "Cơ quan ban hành / nơi nhận" },
  { key: "khu-vuc-cu", label: "Khu vực cũ" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

async function TabContent({ tab }: { tab: TabKey }) {
  switch (tab) {
    case "linh-vuc":
      return (
        <FieldsTable
          rows={(await listFields()).map(({ _count, ...r }) => ({
            ...r,
            documentCount: _count.documents,
          }))}
        />
      );
    case "co-quan":
      return (
        <AgenciesTable
          rows={(await listIssuingAgencies()).map(({ _count, ...r }) => ({
            ...r,
            documentCount: _count.documents,
          }))}
        />
      );
    case "khu-vuc-cu":
      return (
        <OldAreasTable
          rows={(await listOldAreas()).map(({ _count, ...r }) => ({
            ...r,
            residentialCount: _count.residentials,
          }))}
        />
      );
    default:
      return (
        <DocumentTypesTable
          rows={(await listDocumentTypes()).map(({ _count, ...r }) => ({
            ...r,
            documentCount: _count.documents,
          }))}
        />
      );
  }
}

export default async function CatalogsPage({ searchParams }: PageProps<"/quan-tri/danh-muc">) {
  await requirePermission("catalog.manage");
  const { tab: raw } = await searchParams;
  const tab: TabKey = TABS.some((t) => t.key === raw) ? (raw as TabKey) : "loai-van-ban";

  return (
    <>
      <PageHeader
        title={vi.nav.catalogs}
        description="Danh mục dùng chung khi nhập văn bản và địa bàn."
      />
      {/* Thẻ chọn danh mục — đường dẫn ?tab= để bấm "Quay lại" vẫn đúng thẻ */}
      <nav aria-label="Chọn danh mục" className="mb-5 flex flex-wrap gap-2 border-b pb-3">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={{ pathname: "/quan-tri/danh-muc", query: { tab: t.key } }}
            aria-current={t.key === tab ? "page" : undefined}
            className={cn(
              "rounded-lg px-4 py-2 font-medium transition-colors",
              t.key === tab ? "bg-brand text-white" : "bg-card text-foreground hover:bg-brand-soft",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <TabContent tab={tab} />
    </>
  );
}
