import { Bell, CircleUserRound, Search } from "lucide-react";
import Link from "next/link";

import { FontSizeToggle } from "@/components/layout/FontSizeToggle";
import { MobileNav } from "@/components/layout/MobileNav";
import { Button } from "@/components/ui/button";
import type { FontScale } from "@/lib/font-scale";
import { vi } from "@/lib/i18n/vi";

export function Header({ fontScale }: { fontScale: FontScale }) {
  return (
    <header className="no-print sticky top-0 z-40 flex h-16 items-center gap-2 bg-brand px-3 text-brand-foreground shadow-sm md:px-4">
      <MobileNav />

      <Link
        href="/"
        aria-label={vi.app.wardName}
        className="flex min-w-0 items-center gap-3 rounded-lg focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
      >
        {/* Biểu trưng tạm — chờ phường chọn logo (câu hỏi mở 16.11) */}
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-red text-base font-bold"
        >
          {vi.app.shortName}
        </span>
        {/* < 640px không đủ chỗ: tên phường hiện ở đầu menu hamburger */}
        <span className="hidden min-w-0 flex-col leading-tight sm:flex">
          <span className="truncate text-base font-bold tracking-wide uppercase sm:text-lg">
            {vi.app.wardName}
          </span>
          <span className="hidden truncate text-sm text-white/80 lg:block">{vi.app.name}</span>
        </span>
      </Link>

      <div className="flex-1" />

      {/* Tìm kiếm toàn cục (Ctrl+K) — Giai đoạn 5 */}
      <button
        type="button"
        disabled
        title={vi.layout.searchComingSoon}
        className="hidden h-10 w-64 items-center gap-2 rounded-lg bg-white/10 px-3 text-left text-base text-white/80 lg:flex"
      >
        <Search className="size-5" aria-hidden />
        <span className="flex-1">{vi.layout.search}</span>
        <kbd className="rounded border border-white/30 px-1.5 text-xs">
          {vi.layout.searchShortcut}
        </kbd>
      </button>

      <FontSizeToggle initialScale={fontScale} />

      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled
        className="size-11 text-white hover:bg-white/15 hover:text-white disabled:opacity-70"
        aria-label={vi.layout.notifications}
        title={vi.layout.notifications}
      >
        <Bell className="size-5" aria-hidden />
      </Button>

      <Button
        type="button"
        variant="ghost"
        disabled
        className="h-11 gap-2 px-2 text-base text-white hover:bg-white/15 hover:text-white disabled:opacity-70"
        aria-label={vi.layout.account}
      >
        <CircleUserRound className="size-6" aria-hidden />
        <span className="hidden xl:inline">{vi.layout.guest}</span>
      </Button>
    </header>
  );
}
