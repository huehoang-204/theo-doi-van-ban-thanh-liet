// Ban hành / gửi văn bản tới người nhận (GĐ5b) — hàm thuần, có unit test.
import { formatDate, vnDateKey } from "@/lib/format";
import { normalizeForSearch } from "@/lib/text";

export type RecipientChoice = {
  /** Gửi toàn phường: mọi tài khoản đang hoạt động */
  all: boolean;
  departmentIds: readonly string[];
  userIds: readonly string[];
};

export type RecipientUser = { id: string; departmentId: string | null; active: boolean };

/**
 * Đổi lựa chọn người nhận thành danh sách tài khoản: toàn phường / theo đơn vị (tài khoản của đơn vị
 * tại thời điểm gửi) / đích danh. Bỏ tài khoản đã khoá và chính người gửi; không trùng.
 */
export function resolveRecipients(
  choice: RecipientChoice,
  users: readonly RecipientUser[],
  senderId?: string,
): { userIds: string[]; direct: Set<string> } {
  const depts = new Set(choice.departmentIds);
  const direct = new Set(choice.userIds);
  const out: string[] = [];
  for (const u of users) {
    if (!u.active || u.id === senderId) continue;
    if (choice.all || direct.has(u.id) || (u.departmentId !== null && depts.has(u.departmentId)))
      out.push(u.id);
  }
  direct.delete(senderId ?? "");
  return { userIds: out, direct };
}

export function hasRecipients(choice: RecipientChoice): boolean {
  return choice.all || choice.departmentIds.length > 0 || choice.userIds.length > 0;
}

/**
 * Nội dung thông báo như hệ thống văn bản điều hành:
 * "PHÒNG KINH TẾ… đã ban hành văn bản Quyết định V/v: … [45/QĐ-UBND]".
 * Trích yếu đã bắt đầu bằng tên loại ("Kế hoạch triển khai…") thì không lặp lại tên loại.
 */
export function publishTitle(doc: {
  sender: string;
  typeName: string;
  title: string;
  number: string | null;
}): string {
  const what = documentHeadline(doc.typeName, doc.title);
  return `${doc.sender.toLocaleUpperCase("vi")} đã ban hành văn bản ${what}${doc.number ? ` [${doc.number}]` : ""}`;
}

/** "Quyết định V/v: …"; trích yếu đã bắt đầu bằng tên loại thì giữ nguyên ("Kế hoạch triển khai…") */
export function documentHeadline(typeName: string, title: string): string {
  return normalizeForSearch(title).startsWith(normalizeForSearch(typeName))
    ? title
    : `${typeName} ${title}`;
}

/** Nhóm danh sách văn bản ban hành theo ngày (giờ VN), mới nhất trước */
export function groupByDay<T extends { publishedAt: Date }>(
  items: readonly T[],
  now: Date,
): { day: string; label: string; relative: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const it of [...items].sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())) {
    const key = vnDateKey(it.publishedAt);
    groups.set(key, [...(groups.get(key) ?? []), it]);
  }
  const today = Date.parse(`${vnDateKey(now)}T00:00:00Z`);
  return [...groups.entries()].map(([day, list]) => {
    const diff = Math.round((today - Date.parse(`${day}T00:00:00Z`)) / 86_400_000);
    return {
      day,
      label: formatDate(new Date(`${day}T00:00:00Z`)),
      relative: diff <= 0 ? "Hôm nay" : diff === 1 ? "Hôm qua" : `${diff} ngày trước`,
      items: list,
    };
  });
}

/** Trích đoạn ngắn của bình luận cho thông báo */
export function excerpt(text: string, max = 80): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}
