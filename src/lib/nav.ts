// Cấu hình menu thanh bên (Mục 8.2.6) — nguồn duy nhất cho Sidebar, menu mobile và Breadcrumb.
// Mỗi mục gắn một quyền (Action) — menu hiển thị lọc bằng can() theo bảng Mục 12.

import type { Route } from "next";
import {
  ClipboardList,
  FolderTree,
  LayoutDashboard,
  ListChecks,
  ListTodo,
  MapPinned,
  Settings,
  type LucideIcon,
} from "lucide-react";

import { vi } from "@/lib/i18n/vi";
import { can, type Action, type AuthUser } from "@/lib/permissions";

export type NavLeaf = {
  href: Route;
  label: string;
  permission: Action;
};

export type NavItem = Omit<NavLeaf, "permission"> & {
  icon: LucideIcon;
  /** Mục đơn có quyền riêng; mục nhóm hiện khi có ít nhất một mục con được phép */
  permission?: Action;
  children?: readonly NavLeaf[];
};

export const NAV_ITEMS: readonly NavItem[] = [
  {
    href: "/",
    label: vi.nav.dashboard,
    icon: LayoutDashboard,
    permission: "dashboard.viewReduced",
  },
  { href: "/viec-cua-toi", label: vi.nav.myWork, icon: ListChecks, permission: "myWork.view" },
  { href: "/van-ban", label: vi.nav.documents, icon: FolderTree, permission: "document.list" },
  { href: "/bao-cao", label: vi.nav.reports, icon: ClipboardList, permission: "report.list" },
  { href: "/cong-viec", label: vi.nav.tasks, icon: ListTodo, permission: "task.list" },
  {
    href: "/dia-ban/thong-tin-phuong",
    label: vi.nav.area,
    icon: MapPinned,
    children: [
      { href: "/dia-ban/thong-tin-phuong", label: vi.nav.wardProfile, permission: "ward.view" },
      { href: "/dia-ban/truong-hoc", label: vi.nav.schools, permission: "school.view" },
      { href: "/dia-ban/to-dan-pho", label: vi.nav.residentials, permission: "residential.view" },
      { href: "/dia-ban/to-chuc-dang", label: vi.nav.partyOrgs, permission: "partyOrg.view" },
    ],
  },
  {
    href: "/quan-tri/nguoi-dung",
    label: vi.nav.admin,
    icon: Settings,
    children: [
      { href: "/quan-tri/nguoi-dung", label: vi.nav.users, permission: "user.manage" },
      { href: "/quan-tri/don-vi", label: vi.nav.departments, permission: "department.manage" },
      { href: "/quan-tri/danh-muc", label: vi.nav.catalogs, permission: "catalog.manage" },
      { href: "/quan-tri/nhat-ky", label: vi.nav.auditLog, permission: "auditLog.view" },
      { href: "/quan-tri/thung-rac", label: vi.nav.trash, permission: "trash.manage" },
    ],
  },
];

/** Các đường dẫn menu người dùng được thấy (chuỗi — truyền được từ server sang client component) */
export function allowedNavHrefs(user: AuthUser): string[] {
  const hrefs: string[] = [];
  for (const item of NAV_ITEMS) {
    if (item.children) {
      for (const child of item.children) if (can(user, child.permission)) hrefs.push(child.href);
    } else if (item.permission && can(user, item.permission)) {
      hrefs.push(item.href);
    }
  }
  return hrefs;
}

/** Lọc menu theo danh sách đường dẫn được phép; nhóm trỏ tới mục con được phép đầu tiên */
export function visibleNavItems(allowed: readonly string[]): NavItem[] {
  const ok = new Set(allowed);
  const out: NavItem[] = [];
  for (const item of NAV_ITEMS) {
    if (item.children) {
      const children = item.children.filter((c) => ok.has(c.href));
      if (children.length > 0) out.push({ ...item, href: children[0]!.href, children });
    } else if (ok.has(item.href)) {
      out.push(item);
    }
  }
  return out;
}

/** Mục có đang được chọn với đường dẫn hiện tại không ("/" chỉ khớp chính nó) */
export function isActivePath(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Nhóm (có con) đang chứa đường dẫn hiện tại */
export function isGroupActive(item: NavItem, pathname: string): boolean {
  if (item.children) return item.children.some((c) => isActivePath(c.href, pathname));
  return isActivePath(item.href, pathname);
}

export type Crumb = { label: string; href?: Route };

/** Cookie nhớ trạng thái thu gọn thanh bên (màn ≥ 1280px) */
export const SIDEBAR_COOKIE = "sidebar-collapsed";

/**
 * Breadcrumb tĩnh theo menu: "/dia-ban/truong-hoc" → [Địa bàn, Trường học].
 * Trang chi tiết (VD /van-ban/abc) dừng ở mục menu gần nhất; trang tự nối thêm crumb của mình.
 */
export function getNavBreadcrumb(pathname: string): Crumb[] {
  for (const item of NAV_ITEMS) {
    if (item.children) {
      const child = item.children.find((c) => isActivePath(c.href, pathname));
      if (child) return [{ label: item.label }, { label: child.label, href: child.href }];
    } else if (isActivePath(item.href, pathname)) {
      return [{ label: item.label, href: item.href }];
    }
  }
  const extra = PAGES_OUTSIDE_MENU.find((p) => isActivePath(p.href, pathname));
  return extra ? [extra] : [];
}

/** Trang không nằm trên menu nhưng vẫn cần breadcrumb (mở từ header) */
const PAGES_OUTSIDE_MENU: ReadonlyArray<{ href: Route; label: string }> = [
  { href: "/thong-bao", label: vi.nav.notifications },
];
