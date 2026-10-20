import { cookies } from "next/headers";

import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { FONT_SCALE_COOKIE, parseFontScale } from "@/lib/font-scale";
import { vi } from "@/lib/i18n/vi";
import { allowedNavHrefs, SIDEBAR_COOKIE } from "@/lib/nav";
import { ROLE_LABELS } from "@/lib/permissions";
import { requireUser } from "@/server/auth/current-user";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const cookieStore = await cookies();
  const fontScale = parseFontScale(cookieStore.get(FONT_SCALE_COOKIE)?.value ?? user.fontScale);
  const sidebarCollapsed = cookieStore.get(SIDEBAR_COOKIE)?.value === "1";
  const allowed = allowedNavHrefs(user);

  return (
    <div className="min-h-dvh">
      <a
        href="#noi-dung-chinh"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-brand"
      >
        {vi.layout.skipToContent}
      </a>
      <Header
        fontScale={fontScale}
        allowed={allowed}
        user={{
          fullName: user.fullName,
          roleLabels: user.roles.map((r) => ROLE_LABELS[r]),
          departmentName: user.departmentName,
        }}
      />
      <div className="flex">
        <Sidebar initialCollapsed={sidebarCollapsed} allowed={allowed} />
        <main id="noi-dung-chinh" className="min-w-0 flex-1 px-4 py-6 md:px-6 xl:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
