// Cấu hình menu thanh bên (Mục 8.2.6) — nguồn duy nhất cho Sidebar, menu mobile và Breadcrumb.
// `roles`: để trống = mọi vai trò. Giai đoạn 1 sẽ lọc theo vai trò người đăng nhập.

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

import type { Role } from "@/generated/prisma/enums";
import { vi } from "@/lib/i18n/vi";

export type NavLeaf = {
  href: Route;
  label: string;
  roles?: readonly Role[];
};

export type NavItem = NavLeaf & {
  icon: LucideIcon;
  children?: readonly NavLeaf[];
};

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: vi.nav.dashboard, icon: LayoutDashboard },
  { href: "/viec-cua-toi", label: vi.nav.myWork, icon: ListChecks },
  { href: "/van-ban", label: vi.nav.documents, icon: FolderTree },
  { href: "/bao-cao", label: vi.nav.reports, icon: ClipboardList },
  { href: "/cong-viec", label: vi.nav.tasks, icon: ListTodo },
  {
    href: "/dia-ban/thong-tin-phuong",
    label: vi.nav.area,
    icon: MapPinned,
    children: [
      { href: "/dia-ban/thong-tin-phuong", label: vi.nav.wardProfile },
      { href: "/dia-ban/truong-hoc", label: vi.nav.schools },
      { href: "/dia-ban/to-dan-pho", label: vi.nav.residentials },
      { href: "/dia-ban/to-chuc-dang", label: vi.nav.partyOrgs },
    ],
  },
  {
    href: "/quan-tri/nguoi-dung",
    label: vi.nav.admin,
    icon: Settings,
    roles: ["ADMIN", "LEADER"],
    children: [
      { href: "/quan-tri/nguoi-dung", label: vi.nav.users, roles: ["ADMIN"] },
      { href: "/quan-tri/don-vi", label: vi.nav.departments, roles: ["ADMIN"] },
      { href: "/quan-tri/danh-muc", label: vi.nav.catalogs, roles: ["ADMIN"] },
      { href: "/quan-tri/nhat-ky", label: vi.nav.auditLog, roles: ["ADMIN", "LEADER"] },
      { href: "/quan-tri/thung-rac", label: vi.nav.trash, roles: ["ADMIN"] },
    ],
  },
];

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
  return [];
}
