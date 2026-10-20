import { describe, expect, it } from "vitest";

import { detectFileType, formatFileSize, isPreviewable } from "@/lib/file-type";

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(
    parts.flatMap((p) => (typeof p === "string" ? Array.from(p, (c) => c.charCodeAt(0)) : p)),
  );

const PDF = bytes("%PDF-1.7\n");
const PNG = bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const JPG = bytes([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const DOCX = bytes([0x50, 0x4b, 0x03, 0x04], "....[Content_Types].xml....word/document.xml");
const XLSX = bytes([0x50, 0x4b, 0x03, 0x04], "....[Content_Types].xml....xl/workbook.xml");
const OLE = bytes([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0]);

describe("nhận dạng tệp bằng magic bytes", () => {
  it("nhận đúng các loại cho phép", () => {
    expect(detectFileType(PDF, "KH-45.pdf")).toEqual({
      ok: true,
      kind: "pdf",
      mimeType: "application/pdf",
    });
    expect(detectFileType(PNG, "anh.PNG")).toMatchObject({ ok: true, kind: "png" });
    expect(detectFileType(JPG, "anh.jpeg")).toMatchObject({ ok: true, kind: "jpg" });
    expect(detectFileType(DOCX, "QD.docx")).toMatchObject({ ok: true, kind: "docx" });
    expect(detectFileType(XLSX, "ds.xlsx")).toMatchObject({ ok: true, kind: "xlsx" });
    expect(detectFileType(OLE, "cu.doc")).toMatchObject({ ok: true, kind: "doc" });
    expect(detectFileType(OLE, "cu.xls")).toMatchObject({ ok: true, kind: "xls" });
  });

  it("từ chối tệp đổi đuôi (nội dung không khớp phần mở rộng)", () => {
    const r = detectFileType(PDF, "bao-cao.docx");
    expect(r.ok).toBe(false);
    expect(!r.ok && r.message).toBe(
      "Tệp “bao-cao.docx” có nội dung là PDF nhưng phần mở rộng là “.docx”. Vui lòng kiểm tra lại tệp.",
    );
    expect(detectFileType(DOCX, "QD.xlsx").ok).toBe(false);
  });

  it("từ chối tệp thực thi / định dạng khác dù đặt đuôi .pdf", () => {
    const exe = bytes("MZ\x90\x00");
    expect(detectFileType(exe, "virus.pdf").ok).toBe(false);
    expect(detectFileType(bytes("<html>"), "trang.pdf").ok).toBe(false);
    expect(detectFileType(OLE, "x.ppt").ok).toBe(false);
    expect(detectFileType(new Uint8Array(), "rong.pdf").ok).toBe(false);
  });

  it("xem trước được PDF và ảnh", () => {
    expect(isPreviewable("application/pdf")).toBe(true);
    expect(isPreviewable("image/png")).toBe(true);
    expect(isPreviewable("application/msword")).toBe(false);
  });

  it("kích thước dễ đọc kiểu Việt", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(1536)).toBe("1,5 KB");
    expect(formatFileSize(20 * 1024 * 1024)).toBe("20 MB");
  });
});
