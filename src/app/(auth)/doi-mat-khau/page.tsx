import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ChangePasswordForm } from "@/app/(auth)/doi-mat-khau/ChangePasswordForm";
import { vi } from "@/lib/i18n/vi";
import { homePathFor } from "@/lib/permissions";
import { getCurrentUser } from "@/server/auth/current-user";

export const metadata: Metadata = { title: vi.auth.changePassword };

export default async function ChangePasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/dang-nhap");
  return (
    <>
      <h1 className="mb-2 text-center text-page-title font-bold">{vi.auth.changePassword}</h1>
      <p className="mb-5 text-center text-muted-foreground">{user.fullName}</p>
      {user.mustChangePassword && (
        <p role="status" className="mb-4 rounded-lg bg-status-due-soon/15 px-3 py-2 text-amber-900">
          {vi.auth.mustChangeNotice}
        </p>
      )}
      <ChangePasswordForm home={homePathFor(user)} canCancel={!user.mustChangePassword} />
    </>
  );
}
