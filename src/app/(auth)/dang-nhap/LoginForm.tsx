"use client";

import { useActionState } from "react";

import { FormField } from "@/components/common/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { vi } from "@/lib/i18n/vi";
import { loginAction, type LoginState } from "@/server/actions/auth";

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, {});

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {callbackUrl && <input type="hidden" name="callbackUrl" value={callbackUrl} />}
      <FormField id="username" label={vi.auth.username} required>
        <Input
          id="username"
          name="username"
          defaultValue={state.username}
          autoComplete="username"
          autoCapitalize="none"
          autoFocus
          required
        />
      </FormField>
      <FormField id="password" label={vi.auth.password} required>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </FormField>
      {state.error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" className="mt-2 w-full" disabled={pending}>
        {pending ? vi.auth.loggingIn : vi.auth.login}
      </Button>
      <p className="text-center text-sm text-muted-foreground">{vi.auth.secretWarning}</p>
    </form>
  );
}
