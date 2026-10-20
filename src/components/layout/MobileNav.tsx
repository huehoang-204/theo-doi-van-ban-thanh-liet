"use client";

import { Menu } from "lucide-react";
import { useState } from "react";

import { NavList } from "@/components/layout/NavList";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { vi } from "@/lib/i18n/vi";

/** Menu hamburger cho màn hình < 768px */
export function MobileNav({ allowed }: { allowed: readonly string[] }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 text-white hover:bg-white/15 hover:text-white md:hidden"
          aria-label={vi.layout.openMenu}
        >
          <Menu className="size-6" aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="border-b">
          <SheetTitle className="text-lg">{vi.app.wardName}</SheetTitle>
        </SheetHeader>
        <nav aria-label={vi.layout.mainMenu} className="overflow-y-auto p-3">
          <NavList allowed={allowed} onNavigate={() => setOpen(false)} />
        </nav>
      </SheetContent>
    </Sheet>
  );
}
