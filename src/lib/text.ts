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

export type HighlightPart = { text: string; hit: boolean };

/**
 * Tách chuỗi để tô sáng từ khoá, so khớp không dấu: "quyet" tô "Quyết" trong "Quyết định".
 * Bỏ dấu từng ký tự (NFC tiếng Việt: 1 ký tự có dấu → 1 ký tự không dấu) nên vị trí khớp giữ nguyên.
 */
export function highlightParts(text: string, terms: readonly string[]): HighlightPart[] {
  const source = text.normalize("NFC");
  const chars = [...source];
  const folded = chars.map((c) => removeVietnameseTones(c).toLowerCase().charAt(0) || c).join("");
  const hit = new Array<boolean>(chars.length).fill(false);
  for (const raw of terms) {
    const term = normalizeForSearch(raw);
    if (!term) continue;
    for (let i = folded.indexOf(term); i >= 0; i = folded.indexOf(term, i + 1))
      hit.fill(true, i, i + term.length);
  }
  const parts: HighlightPart[] = [];
  chars.forEach((c, i) => {
    const last = parts.at(-1);
    if (last && last.hit === hit[i]) last.text += c;
    else parts.push({ text: c, hit: hit[i]! });
  });
  return parts;
}

/** Chữ viết tắt cho ảnh đại diện: "Nguyễn Thị Thu Hiền" → "NH"; bỏ phần trong ngoặc ("Văn thư (mẫu)" → "VT") */
export function initials(name: string): string {
  const words = name
    .replace(/\([^)]*\)/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "?";
  const first = [...words[0]!][0] ?? "";
  if (words.length === 1) return [...words[0]!].slice(0, 2).join("").toLocaleUpperCase("vi");
  return (first + ([...words.at(-1)!][0] ?? "")).toLocaleUpperCase("vi");
}
