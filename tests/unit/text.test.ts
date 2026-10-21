import { describe, expect, it } from "vitest";

import {
  buildSearchText,
  normalizeForSearch,
  removeVietnameseTones,
  highlightParts,
} from "@/lib/text";

describe("bỏ dấu tiếng Việt", () => {
  it("bỏ mọi dấu thanh và dấu mũ", () => {
    expect(removeVietnameseTones("Kế hoạch Ủy ban Nhân dân")).toBe("Ke hoach Uy ban Nhan dan");
    expect(removeVietnameseTones("ỹ ữ ặ ợ ẫ")).toBe("y u a o a");
  });

  it("chuyển đ/Đ thành d/D", () => {
    expect(removeVietnameseTones("Đảng bộ đô thị")).toBe("Dang bo do thi");
  });

  it("xử lý chuỗi dựng sẵn (NFC) lẫn tổ hợp (NFD)", () => {
    expect(removeVietnameseTones("Quyết".normalize("NFD"))).toBe("Quyet");
  });
});

describe("chuẩn hoá tìm kiếm", () => {
  it("khớp không dấu như tiêu chí nghiệm thu Giai đoạn 2", () => {
    const haystack = normalizeForSearch("Quyết định thành lập Tổ công tác chuyển đổi số");
    expect(haystack).toContain(normalizeForSearch("quyet dinh thanh lap"));
  });

  it("gộp khoảng trắng và cắt hai đầu", () => {
    expect(normalizeForSearch("  Kế   hoạch\n45 ")).toBe("ke hoach 45");
  });

  it("buildSearchText ghép số, trích yếu, thẻ và bỏ phần rỗng", () => {
    expect(buildSearchText("45/KH-UBND", "Chuyển đổi số", null, undefined, ["Đô thị", ""])).toBe(
      "45/kh-ubnd chuyen doi so do thi",
    );
  });
});

describe("highlightParts — tô sáng không dấu", () => {
  it("khớp không dấu, giữ nguyên chữ gốc có dấu", () => {
    expect(highlightParts("Quyết định thành lập Tổ công tác", ["quyet", "thanh lap"])).toEqual([
      { text: "Quyết", hit: true },
      { text: " định ", hit: false },
      { text: "thành lập", hit: true },
      { text: " Tổ công tác", hit: false },
    ]);
  });

  it("đ/Đ, chữ hoa, nhiều lần xuất hiện; không có từ khoá thì một phần", () => {
    expect(
      highlightParts("Đảng bộ – đảng viên", ["dang"])
        .filter((p) => p.hit)
        .map((p) => p.text),
    ).toEqual(["Đảng", "đảng"]);
    expect(highlightParts("Trường THCS", [])).toEqual([{ text: "Trường THCS", hit: false }]);
  });
});
