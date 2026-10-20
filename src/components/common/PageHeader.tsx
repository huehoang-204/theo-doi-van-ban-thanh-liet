import { AppBreadcrumb } from "@/components/layout/AppBreadcrumb";
import type { Crumb } from "@/lib/nav";

type PageHeaderProps = {
  title: string;
  description?: string;
  /** Nút chính của màn hình — chỉ 1 nút (Mục 8.2.7), góc phải trên */
  action?: React.ReactNode;
  breadcrumbExtra?: Crumb[];
};

export function PageHeader({ title, description, action, breadcrumbExtra }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-3">
      <AppBreadcrumb extra={breadcrumbExtra} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-page-title font-bold text-foreground">{title}</h1>
          {description && <p className="mt-1 text-muted-foreground">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}
