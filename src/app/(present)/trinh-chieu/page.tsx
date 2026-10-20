import type { Metadata } from "next";

import { vi } from "@/lib/i18n/vi";

export const metadata: Metadata = { title: vi.nav.presentation };

// Chế độ trình chiếu lên TV phòng họp: toàn màn hình, không thanh bên — nội dung ở Giai đoạn 4.
export default function PresentationPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-brand px-6 text-center text-white">
      <h1 className="text-4xl font-bold uppercase">{vi.app.wardName}</h1>
      <p className="text-2xl text-white/80">{vi.nav.presentation}</p>
      <p className="text-xl text-white/70">{vi.common.plannedForPhase(4)}</p>
    </main>
  );
}
