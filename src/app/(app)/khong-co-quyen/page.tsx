import type { Metadata } from "next";
import { ShieldX } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { vi } from "@/lib/i18n/vi";
import { homePathFor } from "@/lib/permissions";
import { requireUser } from "@/server/auth/current-user";

export const metadata: Metadata = { title: vi.auth.forbiddenTitle };

export default async function ForbiddenPage() {
  const user = await requireUser();
  return (
    <EmptyState
      icon={ShieldX}
      title={vi.auth.forbiddenTitle}
      description={vi.auth.forbiddenBody}
      action={
        <Button asChild size="lg">
          <Link href={homePathFor(user)}>{vi.common.backHome}</Link>
        </Button>
      }
    />
  );
}
