"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { isActivePath, isGroupActive, visibleNavItems, type NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";

type NavListProps = {
  /** Đường dẫn menu người dùng được thấy (tính ở server theo quyền) */
  allowed: readonly string[];
  /** Chỉ hiện biểu tượng (thanh bên thu gọn) */
  compact?: boolean;
  /** Gọi khi chọn một mục (đóng menu mobile) */
  onNavigate?: () => void;
};

const itemBase =
  "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-base font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";
const itemIdle = "text-sidebar-foreground hover:bg-slate-100";
const itemActive = "bg-sidebar-accent text-sidebar-accent-foreground font-semibold";

export function NavList({ allowed, compact = false, onNavigate }: NavListProps) {
  const pathname = usePathname();
  const items = useMemo(() => visibleNavItems(allowed), [allowed]);

  return (
    <ul className="flex flex-col gap-1">
      {items.map((item) => (
        <li key={item.label}>
          {item.children ? (
            <NavGroup item={item} pathname={pathname} compact={compact} onNavigate={onNavigate} />
          ) : (
            <NavLink item={item} pathname={pathname} compact={compact} onNavigate={onNavigate} />
          )}
        </li>
      ))}
    </ul>
  );
}

type ItemProps = { item: NavItem; pathname: string; compact: boolean; onNavigate?: () => void };

function CompactTooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

function NavLink({ item, pathname, compact, onNavigate }: ItemProps) {
  const active = isActivePath(item.href, pathname);
  const Icon = item.icon;
  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      aria-label={compact ? item.label : undefined}
      className={cn(itemBase, active ? itemActive : itemIdle, compact && "justify-center px-0")}
    >
      <Icon className="size-5 shrink-0" aria-hidden />
      {!compact && <span className="truncate">{item.label}</span>}
    </Link>
  );
  return compact ? <CompactTooltip label={item.label}>{link}</CompactTooltip> : link;
}

function NavGroup({ item, pathname, compact, onNavigate }: ItemProps) {
  const groupActive = isGroupActive(item, pathname);
  const [open, setOpen] = useState(groupActive);
  const Icon = item.icon;

  // Thu gọn: bấm biểu tượng nhóm → mục con đầu tiên
  if (compact) return <NavLink item={item} pathname={pathname} compact onNavigate={onNavigate} />;

  const expanded = open || groupActive;
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!expanded)}
        aria-expanded={expanded}
        className={cn(itemBase, groupActive ? "text-sidebar-accent-foreground" : itemIdle)}
      >
        <Icon className="size-5 shrink-0" aria-hidden />
        <span className="flex-1 truncate text-left">{item.label}</span>
        <ChevronDown
          className={cn("size-4 shrink-0 transition-transform", expanded && "rotate-180")}
          aria-hidden
        />
      </button>
      {expanded && (
        <ul className="mt-1 ml-5 flex flex-col gap-1 border-l border-sidebar-border pl-3">
          {item.children?.map((child) => {
            const active = isActivePath(child.href, pathname);
            return (
              <li key={child.href}>
                <Link
                  href={child.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(itemBase, "min-h-10 py-1.5", active ? itemActive : itemIdle)}
                >
                  {child.label}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
