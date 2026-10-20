"use client";

import { ChevronDown, CircleUserRound, KeyRound, LogOut } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { vi } from "@/lib/i18n/vi";
import { logoutAction } from "@/server/actions/auth";

type UserMenuProps = {
  fullName: string;
  roleLabels: string[];
  departmentName: string | null;
};

export function UserMenu({ fullName, roleLabels, departmentName }: UserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="h-11 gap-2 px-2 text-base text-white hover:bg-white/15 hover:text-white"
          aria-label={`${vi.layout.account}: ${fullName}`}
        >
          <CircleUserRound className="size-6" aria-hidden />
          <span className="hidden max-w-48 truncate xl:inline">{fullName}</span>
          <ChevronDown className="hidden size-4 xl:inline" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="flex flex-col gap-0.5 py-2">
          <span className="text-base font-semibold text-foreground">{fullName}</span>
          <span className="text-sm font-normal">{roleLabels.join(" · ")}</span>
          {departmentName && <span className="text-sm font-normal">{departmentName}</span>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/doi-mat-khau">
            <KeyRound aria-hidden />
            {vi.auth.changePassword}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <form action={logoutAction} className="w-full">
            <button
              type="submit"
              className="flex w-full items-center gap-2 text-left"
              data-testid="logout"
            >
              <LogOut className="size-4" aria-hidden />
              {vi.auth.logout}
            </button>
          </form>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
