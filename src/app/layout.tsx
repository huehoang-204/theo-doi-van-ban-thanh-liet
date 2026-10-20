import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import { cookies } from "next/headers";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FONT_SCALE_COOKIE, fontScaleCssValue, parseFontScale } from "@/lib/font-scale";
import { vi } from "@/lib/i18n/vi";

import "./globals.css";

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: vi.app.wardName, template: `%s — ${vi.app.wardName}` },
  description: vi.app.description,
};

export const viewport: Viewport = {
  themeColor: "#1e3a8a",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Đọc cỡ chữ ở server để trang hiện đúng cỡ ngay, không nháy.
  const fontScale = parseFontScale((await cookies()).get(FONT_SCALE_COOKIE)?.value);

  return (
    <html
      lang="vi"
      className={beVietnamPro.variable}
      style={{ "--font-scale": fontScaleCssValue(fontScale) } as React.CSSProperties}
    >
      <body>
        <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}
