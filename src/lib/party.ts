// Quy tắc cây tổ chức đảng (Mục 6.4) & số liệu tự đếm cho bảng điều hành — hàm thuần, có unit test.
import type { PartyBlock, PartyOrgType } from "@/generated/prisma/enums";

/** Loại cấp trên hợp lệ cho từng loại tổ chức */
const ALLOWED_PARENT: Record<PartyOrgType, readonly PartyOrgType[] | null> = {
  DANG_BO_PHUONG: null, // gốc, không có cấp trên
  DANG_BO_BO_PHAN: ["DANG_BO_PHUONG"],
  DANG_BO_CO_SO: ["DANG_BO_PHUONG"],
  CHI_BO_CO_SO: ["DANG_BO_PHUONG"],
  CHI_BO_TRUC_THUOC: ["DANG_BO_BO_PHAN", "DANG_BO_CO_SO"],
};

export const CELL_TYPES: readonly PartyOrgType[] = ["CHI_BO_CO_SO", "CHI_BO_TRUC_THUOC"];

/** Trả về câu lỗi tiếng Việt nếu cấp trên không hợp lệ, null nếu hợp lệ */
export function validatePartyParent(
  type: PartyOrgType,
  parent: { id: string; type: PartyOrgType } | null,
  selfId?: string | null,
): string | null {
  const allowed = ALLOWED_PARENT[type];
  if (allowed === null) {
    return parent ? "Đảng bộ phường là cấp cao nhất, không có cấp trên." : null;
  }
  if (!parent) return "Vui lòng chọn cấp trên trực tiếp.";
  if (selfId && parent.id === selfId) return "Không thể chọn chính tổ chức này làm cấp trên.";
  if (!allowed.includes(parent.type)) {
    return type === "CHI_BO_TRUC_THUOC"
      ? "Chi bộ trực thuộc phải thuộc một Đảng bộ bộ phận hoặc Đảng bộ cơ sở."
      : "Tổ chức này phải trực thuộc Đảng bộ phường.";
  }
  return null;
}

export type PartyOrgStatInput = {
  id: string;
  parentId: string | null;
  type: PartyOrgType;
  block: PartyBlock;
  memberCount: number;
  active: boolean;
};

export type PartyStats = {
  /** Tổ chức đảng trực thuộc (mọi loại trừ Đảng bộ phường) */
  orgCount: number;
  /** Chi bộ (cơ sở + trực thuộc) */
  cellCount: number;
  /** Tổng đảng viên = cộng số đảng viên ở các tổ chức lá (tránh đếm trùng đảng bộ bộ phận) */
  memberCount: number;
  cellsByBlock: Partial<Record<PartyBlock, number>>;
};

export function computePartyStats(orgs: readonly PartyOrgStatInput[]): PartyStats {
  const active = orgs.filter((o) => o.active);
  const hasChildren = new Set(active.map((o) => o.parentId).filter((id): id is string => !!id));
  const cellsByBlock: Partial<Record<PartyBlock, number>> = {};
  let cellCount = 0;
  for (const o of active) {
    if (CELL_TYPES.includes(o.type)) {
      cellCount++;
      cellsByBlock[o.block] = (cellsByBlock[o.block] ?? 0) + 1;
    }
  }
  return {
    orgCount: active.filter((o) => o.type !== "DANG_BO_PHUONG").length,
    cellCount,
    memberCount: active
      .filter((o) => !hasChildren.has(o.id))
      .reduce((s, o) => s + o.memberCount, 0),
    cellsByBlock,
  };
}

export type TreeRow<T> = T & { depth: number };

/** Sắp cây thành danh sách phẳng theo thứ tự duyệt sâu (cha trước con), kèm độ sâu */
export function flattenTree<T extends { id: string; parentId: string | null }>(
  items: readonly T[],
  compare: (a: T, b: T) => number,
): TreeRow<T>[] {
  const ids = new Set(items.map((i) => i.id));
  const byParent = new Map<string | null, T[]>();
  for (const item of items) {
    const key = item.parentId && ids.has(item.parentId) ? item.parentId : null;
    byParent.set(key, [...(byParent.get(key) ?? []), item]);
  }
  const out: TreeRow<T>[] = [];
  const visit = (parentId: string | null, depth: number) => {
    for (const item of [...(byParent.get(parentId) ?? [])].sort(compare)) {
      out.push({ ...item, depth });
      visit(item.id, depth + 1);
    }
  };
  visit(null, 0);
  return out;
}
