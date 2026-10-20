"use client";

import { CalendarDays } from "lucide-react";
import { useState } from "react";
import { vi as viLocale } from "react-day-picker/locale";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { parseViDate } from "@/lib/schemas/common";

type DateInputProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
  label: string;
};

/** Nhãn thứ gọn (mặc định "Th 2" quá dài cho ô lịch) */
const WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

const pad = (n: number) => String(n).padStart(2, "0");
/** Date (giờ máy) → "dd/mm/yyyy" */
const toText = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;

/** Ô ngày (Mục 8.2.9): gõ dd/mm/yyyy hoặc chọn trên lịch tiếng Việt, tuần bắt đầu Thứ Hai */
export function DateInput({
  id,
  value,
  onChange,
  onBlur,
  invalid,
  describedBy,
  disabled,
  label,
}: DateInputProps) {
  const [open, setOpen] = useState(false);
  const parsed = value ? parseViDate(value) : null;
  // parseViDate trả 00:00 UTC — đổi sang ngày theo giờ máy để lịch tô đúng ô
  const selected = parsed
    ? new Date(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate())
    : undefined;

  return (
    <div className="flex gap-2">
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder="dd/mm/yyyy"
        inputMode="numeric"
        autoComplete="off"
        aria-invalid={invalid}
        aria-describedby={describedBy}
        disabled={disabled}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11 shrink-0"
            disabled={disabled}
            aria-label={`Chọn ${label.toLowerCase()} trên lịch`}
          >
            <CalendarDays aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            locale={viLocale}
            className="[--cell-size:2.75rem]"
            formatters={{ formatWeekdayName: (d) => WEEKDAYS[d.getDay()]! }}
            weekStartsOn={1}
            selected={selected}
            defaultMonth={selected}
            captionLayout="dropdown"
            onSelect={(d) => {
              if (d) onChange(toText(d));
              setOpen(false);
              onBlur?.();
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
