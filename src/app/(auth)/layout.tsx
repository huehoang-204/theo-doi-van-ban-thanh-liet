import { vi } from "@/lib/i18n/vi";

/** Khung trang đăng nhập / đổi mật khẩu: nền xanh hành chính, thẻ trắng ở giữa */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-brand px-4 py-10">
      <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-lg sm:p-8">
        <div className="mb-6 text-center">
          <span
            aria-hidden
            className="mx-auto mb-3 flex size-14 items-center justify-center rounded-xl bg-accent-red text-xl font-bold text-white"
          >
            {vi.app.shortName}
          </span>
          <p className="text-xl font-bold text-brand uppercase">{vi.app.wardName}</p>
          <p className="mt-1 text-muted-foreground">{vi.app.name}</p>
        </div>
        {children}
      </div>
    </main>
  );
}
