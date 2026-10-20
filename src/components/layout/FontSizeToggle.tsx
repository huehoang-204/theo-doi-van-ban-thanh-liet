"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  FONT_SCALE_COOKIE,
  fontScaleCssValue,
  stepFontScale,
  type FontScale,
} from "@/lib/font-scale";
import { vi } from "@/lib/i18n/vi";
import { saveFontScale } from "@/server/actions/auth";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function FontSizeToggle({ initialScale }: { initialScale: FontScale }) {
  const [scale, setScale] = useState<FontScale>(initialScale);

  function change(direction: 1 | -1) {
    const next = stepFontScale(scale, direction);
    if (next === scale) return;
    setScale(next);
    document.documentElement.style.setProperty("--font-scale", fontScaleCssValue(next));
    document.cookie = `${FONT_SCALE_COOKIE}=${next}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
    // Lưu theo tài khoản để áp dụng trên máy khác (lỗi mạng không ảnh hưởng hiển thị hiện tại)
    void saveFontScale(next).catch(() => undefined);
  }

  return (
    <div
      role="group"
      aria-label={vi.fontSize.group}
      className="flex items-center rounded-lg border border-white/30"
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-9 rounded-r-none px-2.5 font-semibold text-white hover:bg-white/15 hover:text-white"
        onClick={() => change(-1)}
        disabled={scale === stepFontScale(scale, -1)}
        aria-label={vi.fontSize.decrease}
        title={vi.fontSize.decrease}
      >
        A−
      </Button>
      <span className="sr-only" aria-live="polite">
        {vi.fontSize.current(scale)}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-9 rounded-l-none border-l border-white/30 px-2.5 text-lg font-semibold text-white hover:bg-white/15 hover:text-white"
        onClick={() => change(1)}
        disabled={scale === stepFontScale(scale, 1)}
        aria-label={vi.fontSize.increase}
        title={vi.fontSize.increase}
        data-testid="font-increase"
      >
        A+
      </Button>
    </div>
  );
}
