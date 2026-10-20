import type { Metadata } from "next";

import { DocumentsEmptyState } from "@/components/document-tree/DocumentsEmptyState";
import { vi } from "@/lib/i18n/vi";

export const metadata: Metadata = { title: vi.nav.documents };

/** Cột phải khi chưa chọn văn bản */
export default function DocumentsPage() {
  return <DocumentsEmptyState />;
}
