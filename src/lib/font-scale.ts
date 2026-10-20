// Cỡ chữ A−/A+ (Mục 8.2.2). Giai đoạn 0 lưu trong cookie; Giai đoạn 1 đồng bộ thêm vào User.fontScale.

export const FONT_SCALES = [100, 112, 125] as const;
export type FontScale = (typeof FONT_SCALES)[number];

export const DEFAULT_FONT_SCALE: FontScale = 100;
export const FONT_SCALE_COOKIE = "font-scale";

export function parseFontScale(value: string | number | null | undefined): FontScale {
  const n = typeof value === "number" ? value : Number(value);
  return (FONT_SCALES as readonly number[]).includes(n) ? (n as FontScale) : DEFAULT_FONT_SCALE;
}

/** Bước lên/xuống trong FONT_SCALES, dừng ở hai đầu */
export function stepFontScale(current: FontScale, direction: 1 | -1): FontScale {
  const index = FONT_SCALES.indexOf(current);
  const next = Math.min(FONT_SCALES.length - 1, Math.max(0, index + direction));
  return FONT_SCALES[next] ?? DEFAULT_FONT_SCALE;
}

/** Giá trị CSS cho biến --font-scale */
export function fontScaleCssValue(scale: FontScale): string {
  return String(scale / 100);
}
