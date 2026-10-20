import { describe, expect, it } from "vitest";

import { escapeLike, isSearchable, likePatterns, searchTerms } from "@/lib/search";

describe("từ khoá tìm kiếm văn bản", () => {
  it("tách từ, chữ thường, bỏ trùng", () => {
    expect(searchTerms("  Quyet  dinh thanh   LAP quyet ")).toEqual([
      "quyet",
      "dinh",
      "thanh",
      "lap",
    ]);
    expect(searchTerms("45/QĐ-UBND")).toEqual(["45/qđ-ubnd"]);
  });

  it("thoát ký tự đặc biệt của LIKE để không khớp nhầm", () => {
    expect(escapeLike("50%_a\\b")).toBe("50\\%\\_a\\\\b");
    expect(likePatterns("100% số")).toEqual(["%100\\%%", "%số%"]);
  });

  it("tối đa 8 từ; cần ít nhất 2 ký tự", () => {
    expect(searchTerms("a b c d e f g h i j")).toHaveLength(8);
    expect(isSearchable(" k ")).toBe(false);
    expect(isSearchable("kh")).toBe(true);
  });
});
