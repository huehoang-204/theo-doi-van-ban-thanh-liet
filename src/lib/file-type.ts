// Nhận dạng loại tệp bằng "magic bytes" (Mục 13.2) — không tin phần mở rộng hay MIME trình duyệt gửi.
// Chấp nhận: PDF, DOC/DOCX, XLS/XLSX, JPG, PNG (Mục 4.3).

export type AllowedKind = "pdf" | "doc" | "docx" | "xls" | "xlsx" | "jpg" | "png";

export const ALLOWED_EXTENSIONS: Record<AllowedKind, readonly string[]> = {
  pdf: ["pdf"],
  doc: ["doc"],
  docx: ["docx"],
  xls: ["xls"],
  xlsx: ["xlsx"],
  jpg: ["jpg", "jpeg"],
  png: ["png"],
};

export const MIME_TYPES: Record<AllowedKind, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  jpg: "image/jpeg",
  png: "image/png",
};

export const ACCEPT_ATTRIBUTE = ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png";

/**
 * Cách xem trước trên trình duyệt: PDF/ảnh hiển thị trực tiếp; DOCX/XLSX dựng lại ở trình duyệt (GĐ5b);
 * DOC/XLS đời cũ chỉ tải về.
 */
export type PreviewKind = "pdf" | "image" | "docx" | "xlsx";

export function previewKind(mimeType: string): PreviewKind | null {
  if (mimeType === MIME_TYPES.pdf) return "pdf";
  if (mimeType === MIME_TYPES.jpg || mimeType === MIME_TYPES.png) return "image";
  if (mimeType === MIME_TYPES.docx) return "docx";
  if (mimeType === MIME_TYPES.xlsx) return "xlsx";
  return null;
}

/** Máy chủ trả tệp "inline" (trình duyệt tự hiển thị): PDF, ảnh */
export function isPreviewable(mimeType: string): boolean {
  return mimeType === MIME_TYPES.pdf || mimeType === MIME_TYPES.jpg || mimeType === MIME_TYPES.png;
}

const startsWith = (bytes: Uint8Array, sig: readonly number[], offset = 0) =>
  bytes.length >= offset + sig.length && sig.every((b, i) => bytes[offset + i] === b);

const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPG = [0xff, 0xd8, 0xff];
const ZIP = [0x50, 0x4b, 0x03, 0x04]; // DOCX/XLSX là gói ZIP
const OLE2 = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]; // DOC/XLS đời cũ

function containsAscii(bytes: Uint8Array, text: string): boolean {
  const needle = Array.from(text, (c) => c.charCodeAt(0));
  outer: for (let i = 0; i <= bytes.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) if (bytes[i + j] !== needle[j]) continue outer;
    return true;
  }
  return false;
}

export function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : "";
}

export type DetectResult =
  { ok: true; kind: AllowedKind; mimeType: string } | { ok: false; message: string };

/**
 * Xác định loại tệp từ nội dung + tên. `head`: tối thiểu vài KB đầu tệp (DOCX/XLSX cần đọc tên mục
 * trong ZIP — "word/" hoặc "xl/" nằm ở phần đầu gói do Office ghi).
 */
export function detectFileType(head: Uint8Array, fileName: string): DetectResult {
  const ext = extensionOf(fileName);
  let kind: AllowedKind | null = null;
  if (startsWith(head, PDF)) kind = "pdf";
  else if (startsWith(head, PNG)) kind = "png";
  else if (startsWith(head, JPG)) kind = "jpg";
  else if (startsWith(head, ZIP)) {
    if (containsAscii(head, "word/")) kind = "docx";
    else if (containsAscii(head, "xl/")) kind = "xlsx";
    else if (ext === "docx" || ext === "xlsx") kind = ext; // gói ZIP hợp lệ nhưng mục đầu không lộ tên thư mục
  } else if (startsWith(head, OLE2)) {
    if (ext === "doc" || ext === "xls") kind = ext;
  }

  if (!kind) {
    return {
      ok: false,
      message: `Tệp “${fileName}” không đúng định dạng cho phép (PDF, DOC, DOCX, XLS, XLSX, JPG, PNG) hoặc nội dung không khớp phần mở rộng.`,
    };
  }
  if (!ALLOWED_EXTENSIONS[kind].includes(ext)) {
    return {
      ok: false,
      message: `Tệp “${fileName}” có nội dung là ${kind.toUpperCase()} nhưng phần mở rộng là “.${ext || "?"}”. Vui lòng kiểm tra lại tệp.`,
    };
  }
  return { ok: true, kind, mimeType: MIME_TYPES[kind] };
}

/** Kích thước dễ đọc: 1,5 MB */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(value)} ${units[unit]}`;
}
