"use client";

import { BellOff, BellRing } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { setDocumentFollow } from "@/server/actions/publishing";

/** Theo dõi văn bản → nhận thông báo thảo luận mới và văn bản mới trong nhánh (Mục 5.4) */
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
          const r = await setDocumentFollow({ id, follow: !on });
          if (!r.ok) return void toast.error(r.error.message);
          setOn(r.data.following);
          toast.success(
            r.data.following
              ? "Đã theo dõi — bạn sẽ được báo khi có thảo luận hoặc văn bản mới trong nhánh."
              : "Đã bỏ theo dõi.",
          );
          router.refresh();
        })
      }
    >
      {on ? <BellRing aria-hidden /> : <BellOff aria-hidden />}
      {on ? "Đang theo dõi" : "Theo dõi"}
    </Button>
  );
}
