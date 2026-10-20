import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/common/PlaceholderPage";
import { vi } from "@/lib/i18n/vi";

export const metadata: Metadata = { title: vi.nav.documents };

export default function Page() {
  return <PlaceholderPage title={vi.nav.documents} phase={2} permission="document.list" />;
}
