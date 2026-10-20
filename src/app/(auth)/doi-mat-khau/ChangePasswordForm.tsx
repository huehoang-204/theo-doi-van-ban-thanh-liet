"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

import { EntityForm, type FieldConfig } from "@/components/common/EntityForm";
import { Button } from "@/components/ui/button";
import { vi } from "@/lib/i18n/vi";
import { changePasswordSchema } from "@/lib/schemas/auth";
import { changePassword, logoutAction } from "@/server/actions/auth";

const FIELDS: FieldConfig[] = [
  {
    name: "currentPassword",
    label: vi.auth.currentPassword,
    type: "password",
    required: true,
    wide: true,
    autoComplete: "current-password",
  },
  {
    name: "newPassword",
    label: vi.auth.newPassword,
    type: "password",
    required: true,
    wide: true,
    hint: vi.auth.passwordRule,
  },
  {
    name: "confirmPassword",
    label: vi.auth.confirmPassword,
    type: "password",
    required: true,
    wide: true,
  },
];

export function ChangePasswordForm({
  home,
  canCancel,
}: {
  home: "/" | "/viec-cua-toi";
  canCancel: boolean;
}) {
  const router = useRouter();
  return (
    <div className="flex flex-col gap-4">
      <EntityForm
        fields={FIELDS}
        schema={changePasswordSchema}
        defaultValues={{ currentPassword: "", newPassword: "", confirmPassword: "" }}
        action={(values) => changePassword(values as never)}
        submitLabel={vi.auth.changePassword}
        successMessage={vi.auth.changedPassword}
        onSuccess={() => {
          router.replace(home);
          router.refresh();
        }}
        onCancel={canCancel ? () => router.back() : undefined}
      />
      <form action={logoutAction} className="text-center">
        <Button type="submit" variant="link" className="text-muted-foreground">
          <LogOut aria-hidden />
          {vi.auth.logout}
        </Button>
      </form>
    </div>
  );
}
