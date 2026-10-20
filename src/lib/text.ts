// Chuẩn hoá chuỗi tiếng Việt để tìm kiếm không dấu (Mục 4.4, 8.2.13).
// NFD tách dấu thành ký tự tổ hợp nhưng KHÔNG tách "đ/Đ" (là chữ riêng) → phải map tay.

const COMBINING_MARKS = /[̀-ͯ]/g;

/** "Quyết định Thành lập" → "quyet dinh thanh lap" */
export function removeVietnameseTones(input: string): string {
  return input
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .normalize("NFC");
}

/** Chuẩn hoá để so khớp: bỏ dấu, chữ thường, gộp khoảng trắng */
export function normalizeForSearch(input: string): string {
  return removeVietnameseTones(input).toLowerCase().replace(/\s+/g, " ").trim();
}

/** Giá trị cho cột searchText: ghép các phần (bỏ phần rỗng) rồi chuẩn hoá */
export function buildSearchText(...parts: Array<string | null | undefined | string[]>): string {
  return normalizeForSearch(
    parts
      .flat()
      .filter((p): p is string => typeof p === "string" && p.length > 0)
      .join(" "),
  );
}
