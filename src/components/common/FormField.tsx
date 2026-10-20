import { Info } from "lucide-react";

import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type FormFieldProps = {
  id: string;
  label: string;
  required?: boolean;
  /** Hướng dẫn tại chỗ — biểu tượng ⓘ cạnh nhãn (Mục 8.2.17) */
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
};

/** Nhãn nằm trên ô nhập, dấu * đỏ cho trường bắt buộc, lỗi bằng câu đầy đủ (Mục 8.2.8) */
export function FormField({
  id,
  label,
  required,
  hint,
  error,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center gap-1.5">
        <Label htmlFor={id}>
          {label}
          {required && (
            <span className="text-destructive" aria-hidden>
              *
            </span>
          )}
        </Label>
        {hint && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                aria-label={`Hướng dẫn: ${label}`}
              >
                <Info className="size-4" aria-hidden />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">{hint}</TooltipContent>
          </Tooltip>
        )}
      </div>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-[0.9375rem] text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
