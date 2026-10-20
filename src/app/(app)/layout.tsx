import { cookies } from "next/headers";

import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { FONT_SCALE_COOKIE, parseFontScale } from "@/lib/font-scale";
import { vi } from "@/lib/i18n/vi";
import { SIDEBAR_COOKIE } from "@/lib/nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const fontScale = parseFontScale(cookieStore.get(FONT_SCALE_COOKIE)?.value);
  const sidebarCollapsed = cookieStore.get(SIDEBAR_COOKIE)?.value === "1";

  return (
    <div className="min-h-dvh">
      <a
        href="#noi-dung-chinh"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-brand"
      >
        {vi.layout.skipToContent}
      </a>
      <Header fontScale={fontScale} />
      <div className="flex">
        <Sidebar initialCollapsed={sidebarCollapsed} />
        <main id="noi-dung-chinh" className="min-w-0 flex-1 px-4 py-6 md:px-6 xl:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
