import { Badge } from "@/components/ui/badge";

/** Trạng thái sử dụng — luôn có chữ, không chỉ dựa vào màu (Mục 8.2.5) */
export function ActiveBadge({
  active,
  on = "Đang sử dụng",
  off = "Ngừng sử dụng",
}: {
  active: boolean;
  on?: string;
  off?: string;
}) {
  return active ? (
    <Badge className="bg-status-done/15 text-status-done-late">{on}</Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">
      {off}
    </Badge>
  );
}
