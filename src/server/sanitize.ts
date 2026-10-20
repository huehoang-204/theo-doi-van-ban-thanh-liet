import "server-only";

import sanitizeHtml from "sanitize-html";

/**
 * Lọc HTML của "Nội dung tóm tắt" (Mục 13.2): chỉ giữ định dạng đơn giản của trình soạn thảo,
 * bỏ mọi script, thuộc tính sự kiện, style, liên kết javascript:.
 */
export function sanitizeSummary(html: string | null): string | null {
  if (!html) return null;
  const clean = sanitizeHtml(html, {
    allowedTags: ["p", "br", "div", "b", "strong", "i", "em", "u", "ul", "ol", "li"],
    allowedAttributes: {},
    transformTags: { div: "p" },
  }).trim();
  // Trình soạn thảo rỗng thường còn lại <p><br></p>
  return clean.replace(/<(p|br)\s*\/?>|<\/p>|\s|&nbsp;/g, "") === "" ? null : clean;
}
