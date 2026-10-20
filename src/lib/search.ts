// Chuẩn hoá từ khoá tìm kiếm văn bản. Tìm theo TỪNG TỪ (mọi từ đều phải có, không cần liền nhau):
// "quyet dinh thanh lap" khớp "Quyết định 45/QĐ-UBND Thành lập Tổ công tác…".
// Bỏ dấu làm ở CSDL (unaccent) — ở đây chỉ tách từ và thoát ký tự đặc biệt của LIKE.

export const MAX_SEARCH_TERMS = 8;
export const MIN_QUERY_LENGTH = 2;

/** Thoát %, _ và \ để dùng an toàn trong mẫu LIKE */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Tách từ khoá: bỏ khoảng trắng thừa, chữ thường, bỏ trùng, tối đa MAX_SEARCH_TERMS từ */
export function searchTerms(query: string): string[] {
  const words = query
    .normalize("NFC")
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean);
  return [...new Set(words)].slice(0, MAX_SEARCH_TERMS);
}

/** Mẫu LIKE cho từng từ: "%từ%" (đã thoát ký tự đặc biệt) */
export function likePatterns(query: string): string[] {
  return searchTerms(query).map((t) => `%${escapeLike(t)}%`);
}

export function isSearchable(query: string): boolean {
  return query.trim().length >= MIN_QUERY_LENGTH;
}
