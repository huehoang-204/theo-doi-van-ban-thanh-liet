import { describe, expect, it } from "vitest";

import { fontScaleCssValue, parseFontScale, stepFontScale } from "@/lib/font-scale";

describe("cỡ chữ A−/A+", () => {
  it("chỉ chấp nhận 100/112/125, còn lại về mặc định", () => {
    expect(parseFontScale("112")).toBe(112);
    expect(parseFontScale(125)).toBe(125);
    expect(parseFontScale("150")).toBe(100);
    expect(parseFontScale(undefined)).toBe(100);
    expect(parseFontScale("abc")).toBe(100);
  });

  it("tăng/giảm từng bậc và dừng ở hai đầu", () => {
    expect(stepFontScale(100, 1)).toBe(112);
    expect(stepFontScale(112, 1)).toBe(125);
    expect(stepFontScale(125, 1)).toBe(125);
    expect(stepFontScale(112, -1)).toBe(100);
    expect(stepFontScale(100, -1)).toBe(100);
  });

  it("đổi sang hệ số CSS", () => {
    expect(fontScaleCssValue(112)).toBe("1.12");
  });
});
