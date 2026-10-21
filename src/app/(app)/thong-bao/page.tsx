import type { Metadata } from "next";

import { PageHeader } from "@/components/common/PageHeader";
import { NotificationList } from "@/components/notifications/NotificationList";
import { vi } from "@/lib/i18n/vi";
import { requirePermission } from "@/server/auth/current-user";
import { listNotifications } from "@/server/notifications";

export const metadata: Metadata = { title: vi.nav.notifications };

const PAGE_SIZE = 30;

/** Toàn bộ thông báo của người đang đăng nhập (`?chuaDoc=1`, `?trang=2`) */
export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission("notification.view");
  const params = await searchParams;
  const unreadOnly = params.chuaDoc === "1";
  const page = Math.max(1, Number(params.trang) || 1);
  const data = await listNotifications(user.id, { limit: PAGE_SIZE, unreadOnly, page });
  return (
    <>
      <PageHeader
        title={vi.nav.notifications}
        description="Nhắc hạn công việc, báo cáo và các thay đổi liên quan đến bạn. Thông báo đã đọc được giữ 90 ngày."
      />
      <NotificationList
        items={data.items}
        unread={data.unread}
        total={data.total}
        unreadOnly={unreadOnly}
        page={page}
        pageCount={Math.max(1, Math.ceil(data.total / PAGE_SIZE))}
      />
    </>
  );
}
