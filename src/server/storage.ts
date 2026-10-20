import "server-only";

import { createReadStream } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

/**
 * Lưu tệp trên ổ cục bộ (Mục 9.1) — lớp trừu tượng để sau đổi sang MinIO/S3.
 * Tệp đặt tên theo id (không dùng tên gốc), thư mục không phục vụ trực tiếp: luôn qua /api/files/:id.
 */
function root(): string {
  const dir = process.env.UPLOAD_DIR;
  if (!dir) throw new Error("Chưa cấu hình UPLOAD_DIR trong .env");
  return path.resolve(dir);
}

/** Khoá lưu theo năm/tháng để thư mục không quá lớn */
export function storageKeyFor(id: string, now = new Date()): string {
  return `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${id}`;
}

function resolveKey(key: string): string {
  const full = path.resolve(root(), key);
  if (!full.startsWith(root() + path.sep)) throw new Error(`Khoá lưu không hợp lệ: ${key}`);
  return full;
}

export async function putFile(key: string, data: Uint8Array): Promise<void> {
  const full = resolveKey(key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, data, { flag: "wx" });
}

export async function fileStream(
  key: string,
): Promise<{ stream: ReadableStream; size: number } | null> {
  const full = resolveKey(key);
  try {
    const info = await stat(full);
    return { stream: Readable.toWeb(createReadStream(full)) as ReadableStream, size: info.size };
  } catch {
    return null;
  }
}

export async function removeFile(key: string): Promise<void> {
  await rm(resolveKey(key), { force: true });
}
