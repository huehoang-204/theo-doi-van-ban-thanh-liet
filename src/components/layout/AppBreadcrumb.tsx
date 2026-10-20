"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { getNavBreadcrumb, type Crumb } from "@/lib/nav";

/** Đường dẫn theo menu; trang chi tiết truyền thêm `extra` (VD: Chương trình X › Kế hoạch 45) */
export function AppBreadcrumb({ extra = [] }: { extra?: Crumb[] }) {
  const pathname = usePathname();
  const crumbs = [...getNavBreadcrumb(pathname), ...extra];
  if (crumbs.length === 0) return null;

  return (
    <Breadcrumb>
      <BreadcrumbList className="text-base">
        {crumbs.map((crumb, i) => {
          const last = i === crumbs.length - 1;
          return (
            <Fragment key={`${crumb.label}-${i}`}>
              <BreadcrumbItem>
                {last || !crumb.href ? (
                  <BreadcrumbPage className={last ? "font-medium" : "text-muted-foreground"}>
                    {crumb.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={crumb.href}>{crumb.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!last && <BreadcrumbSeparator />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
