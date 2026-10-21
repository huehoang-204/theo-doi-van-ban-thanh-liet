// Ảnh đại diện chữ viết tắt & dãy ảnh đại diện (Đã xem, Đã tải) — một màu thương hiệu, không màu mè.
import { initials } from "@/lib/text";
import { cn } from "@/lib/utils";

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      title={name}
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand ring-2 ring-card",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

/** Dãy ảnh đại diện chồng nhau, tối đa `max`, phần còn lại "+N"; tên đầy đủ trong danh sách mở rộng */
export function AvatarStack({
  people,
  max = 12,
  label,
}: {
  people: { id: string; fullName: string; detail?: string | null; at?: string }[];
  max?: number;
  label: string;
}) {
  if (people.length === 0) return <p className="text-muted-foreground">Chưa có ai.</p>;
  const shown = people.slice(0, max);
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-y-1 pl-2 [&::-webkit-details-marker]:hidden">
        <span className="sr-only">{`${label}: ${people.length} người — bấm để xem danh sách`}</span>
        {shown.map((p) => (
          <Avatar key={p.id} name={p.fullName} className="-ml-2 size-8 text-xs" />
        ))}
        {people.length > max && (
          <span className="-ml-2 flex size-8 items-center justify-center rounded-full bg-foreground/80 text-xs font-semibold text-background ring-2 ring-card">
            +{people.length - max}
          </span>
        )}
        <span className="ml-2 text-sm text-brand group-open:hidden">Xem danh sách</span>
      </summary>
      <ul className="mt-2 flex max-h-64 flex-col gap-1.5 overflow-y-auto text-sm">
        {people.map((p) => (
          <li key={p.id} className="flex items-center gap-2">
            <Avatar name={p.fullName} className="size-7 text-[0.6875rem]" />
            <span className="min-w-0 flex-1">
              <span className="block truncate">{p.fullName}</span>
              {(p.detail || p.at) && (
                <span className="block truncate text-muted-foreground">
                  {[p.detail, p.at].filter(Boolean).join(" · ")}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
