import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { sanitizeSummary } = await import("@/server/sanitize");

describe("lọc HTML nội dung tóm tắt", () => {
  it("giữ định dạng đơn giản", () => {
    expect(sanitizeSummary("<p><b>Mục tiêu</b>: <i>số hoá</i></p><ul><li>Một</li></ul>")).toBe(
      "<p><b>Mục tiêu</b>: <i>số hoá</i></p><ul><li>Một</li></ul>",
    );
  });

  it("bỏ script, thuộc tính sự kiện, style, liên kết", () => {
    expect(
      sanitizeSummary(
        '<p onclick="x()" style="color:red">A<script>alert(1)</script><a href="javascript:x">B</a></p>',
      ),
    ).toBe("<p>AB</p>");
    expect(sanitizeSummary('<img src=x onerror="alert(1)">Chữ')).toBe("Chữ");
  });

  it("nội dung rỗng → null", () => {
    expect(sanitizeSummary("<p><br></p>")).toBeNull();
    expect(sanitizeSummary("   ")).toBeNull();
    expect(sanitizeSummary(null)).toBeNull();
  });

  it("div của trình soạn thảo thành đoạn văn", () => {
    expect(sanitizeSummary("<div>Dòng 1</div><div>Dòng 2</div>")).toBe(
      "<p>Dòng 1</p><p>Dòng 2</p>",
    );
  });
});
