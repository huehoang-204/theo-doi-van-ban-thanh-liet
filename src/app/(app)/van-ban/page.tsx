import type { Metadata } from "next";

import { DocumentsEmptyState } from "@/components/document-tree/DocumentsEmptyState";
import { vi } from "@/lib/i18n/vi";

export const metadata: Metadata = { title: vi.nav.documents };

/** Trang cây văn bản: hướng dẫn ngắn (hoặc nút tạo chương trình đầu tiên khi chưa có) — cây do layout hiển thị */
export default function DocumentsPage() {
  return <DocumentsEmptyState />;
}
