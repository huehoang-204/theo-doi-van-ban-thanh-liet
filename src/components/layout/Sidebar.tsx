"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useState } from "react";

import { NavList } from "@/components/layout/NavList";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { vi } from "@/lib/i18n/vi";
import { SIDEBAR_COOKIE } from "@/lib/nav";
import { cn } from "@/lib/utils";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Thanh bên (Mục 8.2.6, 8.2.15):
 *  - < 768px: ẩn, dùng menu hamburger (MobileNav)
 *  - 768–1279px: luôn thu gọn (chỉ biểu tượng)
 *  - ≥ 1280px: đầy đủ, người dùng thu gọn được (nhớ bằng cookie)
 */
export function Sidebar({ initialCollapsed }: { initialCollapsed: boolean }) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "1" : "0"}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
  }

  return (
    <aside
      aria-label={vi.layout.mainMenu}
      className={cn(
        "no-print sticky top-16 hidden h-[calc(100dvh-4rem)] shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex",
        collapsed ? "w-20" : "w-20 xl:w-64",
      )}
    >
      <ScrollArea className="min-h-0 flex-1">
        <nav className="p-3">
          {/* Màn 768–1279: luôn dạng biểu tượng */}
          <div className="xl:hidden">
            <NavList compact />
          </div>
          <div className="hidden xl:block">
            <NavList compact={collapsed} />
          </div>
        </nav>
      </ScrollArea>
      <div className="hidden border-t border-sidebar-border p-3 xl:block">
        <Button
          type="button"
          variant="ghost"
          onClick={toggle}
          className={cn("h-11 w-full justify-start gap-3 text-base", collapsed && "justify-center")}
          aria-label={collapsed ? vi.layout.expandSidebar : vi.layout.collapseSidebar}
          title={collapsed ? vi.layout.expandSidebar : vi.layout.collapseSidebar}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-5" aria-hidden />
          ) : (
            <>
              <PanelLeftClose className="size-5" aria-hidden />
              <span>{vi.layout.collapseSidebar}</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}
