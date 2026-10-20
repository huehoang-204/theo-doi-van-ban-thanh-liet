import type { Metadata } from "next";

import { vi } from "@/lib/i18n/vi";

export const metadata: Metadata = { title: vi.nav.login };

// Khung trang đăng nhập — form thật ở Giai đoạn 1.
export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-brand px-4">
      <div className="w-full max-w-md rounded-xl bg-card p-8 text-center shadow-lg">
        <span
          aria-hidden
          className="mx-auto mb-4 flex size-14 items-center justify-center rounded-xl bg-accent-red text-xl font-bold text-white"
        >
          {vi.app.shortName}
        </span>
        <h1 className="text-page-title font-bold text-brand uppercase">{vi.app.wardName}</h1>
        <p className="mt-1 text-muted-foreground">{vi.app.name}</p>
        <p className="mt-8 rounded-lg bg-muted p-4 text-muted-foreground">
          {vi.common.plannedForPhase(1)}
        </p>
      </div>
    </main>
  );
}
