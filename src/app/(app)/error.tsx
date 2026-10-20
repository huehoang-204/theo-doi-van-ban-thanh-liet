"use client";

import { TriangleAlert } from "lucide-react";

import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { vi } from "@/lib/i18n/vi";

// Không bao giờ hiện stack trace; chỉ câu tiếng Việt + mã lỗi ngắn (Mục 17.7).
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const code = error.digest ?? "KHONG_RO";
  return (
    <EmptyState
      icon={TriangleAlert}
      title={vi.errors.genericTitle}
      description={`${vi.errors.genericBody} ${vi.errors.errorCode(code)}`}
      action={
        <Button type="button" size="lg" onClick={reset}>
          {vi.common.retry}
        </Button>
      }
    />
  );
}
