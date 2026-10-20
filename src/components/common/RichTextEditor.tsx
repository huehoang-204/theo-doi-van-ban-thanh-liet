"use client";

import { Bold, Italic, List, ListOrdered, RemoveFormatting, Underline } from "lucide-react";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type RichTextEditorProps = {
  id: string;
  value: string;
  onChange: (html: string) => void;
  onBlur?: () => void;
  invalid?: boolean;
  describedBy?: string;
  labelledBy?: string;
};

const TOOLS = [
  { command: "bold", icon: Bold, label: "Chữ đậm" },
  { command: "italic", icon: Italic, label: "Chữ nghiêng" },
  { command: "underline", icon: Underline, label: "Gạch chân" },
  { command: "insertUnorderedList", icon: List, label: "Danh sách gạch đầu dòng" },
  { command: "insertOrderedList", icon: ListOrdered, label: "Danh sách đánh số" },
  { command: "removeFormat", icon: RemoveFormatting, label: "Bỏ định dạng" },
] as const;

/**
 * Soạn thảo "rich text đơn giản" (Mục 4.3): đậm, nghiêng, gạch chân, danh sách.
 * HTML được lọc lại ở máy chủ (sanitize-html) trước khi lưu.
 */
export function RichTextEditor({
  id,
  value,
  onChange,
  onBlur,
  invalid,
  describedBy,
  labelledBy,
}: RichTextEditorProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Chỉ đặt nội dung ban đầu — sau đó trình duyệt tự quản lý để không nhảy con trỏ
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function run(command: string) {
    ref.current?.focus();
    document.execCommand(command);
    onChange(ref.current?.innerHTML ?? "");
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-input bg-card focus-within:ring-3 focus-within:ring-ring/50",
        invalid && "border-destructive",
      )}
    >
      <div
        role="toolbar"
        aria-label="Định dạng nội dung"
        className="flex flex-wrap gap-1 border-b p-1"
      >
        {TOOLS.map(({ command, icon: Icon, label }) => (
          <Button
            key={command}
            type="button"
            variant="ghost"
            size="icon-sm"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => run(command)}
            aria-label={label}
            title={label}
          >
            <Icon aria-hidden />
          </Button>
        ))}
      </div>
      <div
        ref={ref}
        id={id}
        role="textbox"
        aria-multiline="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        aria-invalid={invalid}
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => onChange(e.currentTarget.innerHTML)}
        onBlur={onBlur}
        className="prose-summary min-h-28 px-3 py-2 outline-none"
      />
    </div>
  );
}
