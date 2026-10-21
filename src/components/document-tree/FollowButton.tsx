"use client";

import { BellOff, BellRing } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { setProgramFollow } from "@/server/actions/documents";

/** Theo dõi chương trình → nhận thông báo khi có văn bản mới trong cây (Mục 5.4) */
export function FollowButton({ id, following }: { id: string; following: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(following);
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant={on ? "secondary" : "outline"}
      size="sm"
      disabled={pending}
      aria-pressed={on}
      title={
        on
          ? "Bấm để thôi nhận thông báo văn bản mới"
          : "Nhận thông báo khi có văn bản mới trong chương trình"
      }
      onClick={() =>
        startTransition(async () => {
          const r = await setProgramFollow({ id, follow: !on });
          if (!r.ok) return void toast.error(r.error.message);
          setOn(r.data.following);
          toast.success(
            r.data.following
              ? "Đã theo dõi — bạn sẽ được báo khi có văn bản mới trong chương trình."
              : "Đã bỏ theo dõi chương trình.",
          );
          router.refresh();
        })
      }
    >
      {on ? <BellRing aria-hidden /> : <BellOff aria-hidden />}
      {on ? "Đang theo dõi" : "Theo dõi chương trình"}
    </Button>
  );
}
