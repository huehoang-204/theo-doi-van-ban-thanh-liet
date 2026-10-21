import Link from "next/link";

import { FontSizeToggle } from "@/components/layout/FontSizeToggle";
import { GlobalSearch } from "@/components/layout/GlobalSearch";
import { MobileNav } from "@/components/layout/MobileNav";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { UserMenu } from "@/components/layout/UserMenu";
import type { FontScale } from "@/lib/font-scale";
import { vi } from "@/lib/i18n/vi";

type HeaderProps = {
  fontScale: FontScale;
  allowed: readonly string[];
  user: { fullName: string; roleLabels: string[]; departmentName: string | null };
};

export function Header({ fontScale, allowed, user }: HeaderProps) {
  return (
    <header className="no-print sticky top-0 z-40 flex h-16 items-center gap-2 bg-brand px-3 text-brand-foreground shadow-sm md:px-4">
      <MobileNav allowed={allowed} />

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

      <GlobalSearch />

      <FontSizeToggle initialScale={fontScale} />

      <NotificationBell />

      <UserMenu {...user} />
    </header>
  );
}
