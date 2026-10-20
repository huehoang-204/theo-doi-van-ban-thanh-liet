import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/app/(auth)/dang-nhap/LoginForm";
import { vi } from "@/lib/i18n/vi";
import { homePathFor } from "@/lib/permissions";
import { getCurrentUser } from "@/server/auth/current-user";

export const metadata: Metadata = { title: vi.nav.login };

export default async function LoginPage({ searchParams }: PageProps<"/dang-nhap">) {
  const user = await getCurrentUser();
  if (user) redirect(user.mustChangePassword ? "/doi-mat-khau" : homePathFor(user));
  const { callbackUrl } = await searchParams;
  return (
    <>
      <h1 className="mb-5 text-center text-page-title font-bold">{vi.auth.loginTitle}</h1>
      <LoginForm callbackUrl={typeof callbackUrl === "string" ? callbackUrl : undefined} />
    </>
  );
}
