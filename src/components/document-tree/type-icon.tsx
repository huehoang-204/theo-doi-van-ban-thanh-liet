import {
  BarChart3,
  Bell,
  BookOpen,
  CalendarRange,
  FileChartColumn,
  FilePen,
  FileSignature,
  FileText,
  FolderKanban,
  Gavel,
  Landmark,
  ListChecks,
  Mail,
  Megaphone,
  Paperclip,
  Scale,
  ScrollText,
  Stamp,
  type LucideIcon,
} from "lucide-react";

// Biểu tượng theo loại văn bản (DocumentType.icon) — tập cố định để không nạp toàn bộ thư viện icon
const ICONS: Record<string, LucideIcon> = {
  "folder-kanban": FolderKanban,
  landmark: Landmark,
  megaphone: Megaphone,
  gavel: Gavel,
  stamp: Stamp,
  "calendar-range": CalendarRange,
  mail: Mail,
  bell: Bell,
  "book-open": BookOpen,
  scale: Scale,
  "list-checks": ListChecks,
  "file-bar-chart": FileChartColumn,
  "file-chart-column": FileChartColumn,
  "bar-chart": BarChart3,
  "file-signature": FileSignature,
  "file-pen": FilePen,
  paperclip: Paperclip,
  scroll: ScrollText,
  "file-text": FileText,
};

export function TypeIcon({
  icon,
  color,
  className,
}: {
  icon: string;
  color: string;
  className?: string;
}) {
  const Icon = ICONS[icon] ?? FileText;
  return <Icon className={className} style={{ color }} aria-hidden />;
}
