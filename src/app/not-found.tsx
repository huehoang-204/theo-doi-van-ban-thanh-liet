import { SearchX } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { vi } from "@/lib/i18n/vi";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl items-center px-4">
      <EmptyState
        className="w-full"
        icon={SearchX}
        title={vi.errors.notFoundTitle}
        description={vi.errors.notFoundBody}
        action={
          <Button asChild size="lg">
            <Link href="/">{vi.common.backHome}</Link>
          </Button>
        }
      />
    </main>
  );
}
