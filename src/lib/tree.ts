// Cây văn bản — adjacency list + materialized path (Mục 9.3). Hàm thuần, có unit test (tests/unit/tree.test.ts).
//
//   parentId  cha trực tiếp
//   path      "/rootId/…/id/" — chuỗi id tổ tiên, kết thúc bằng chính nó
//   depth     1..MAX_TREE_DEPTH (cấp 1 = Chương trình)
//   rootId    id chương trình gốc (null nếu chính nó là gốc)
//   sortOrder thứ tự trong cùng cha
//
// Cả nhánh: WHERE path LIKE '<path của nút>%'. Di chuyển: tính lại path/depth/rootId của nút và
// mọi con cháu (planMove) rồi ghi trong MỘT transaction.

export const DEFAULT_MAX_TREE_DEPTH = 5;

export type TreePos = {
  id: string;
  path: string;
  depth: number;
  rootId: string | null;
};

/** Nút kèm nhãn để viết thông báo lỗi dễ hiểu */
export type LabeledPos = TreePos & { label: string };

export type NodePlacement = {
  parentId: string | null;
  path: string;
  depth: number;
  rootId: string | null;
};

/** Vị trí của nút mới (hoặc nút sau khi chuyển) dưới `parent` (null = cấp 1) */
export function placementUnder(parent: TreePos | null, id: string): NodePlacement {
  if (!parent) return { parentId: null, path: `/${id}/`, depth: 1, rootId: null };
  return {
    parentId: parent.id,
    path: `${parent.path}${id}/`,
    depth: parent.depth + 1,
    rootId: parent.rootId ?? parent.id,
  };
}

/** Các id trên đường dẫn, từ gốc tới chính nút */
export function pathIds(path: string): string[] {
  return path.split("/").filter(Boolean);
}

/** Id các tổ tiên (không gồm chính nút), từ gốc xuống */
export function ancestorIds(path: string): string[] {
  return pathIds(path).slice(0, -1);
}

/** `candidate` có nằm trong nhánh của `node` (kể cả chính nó) không */
export function isInSubtree(
  node: Pick<TreePos, "path">,
  candidate: Pick<TreePos, "path">,
): boolean {
  return candidate.path.startsWith(node.path);
}

/** Số cấp của nhánh tính từ nút (nút lá = 1) */
export function subtreeHeight(
  node: Pick<TreePos, "depth">,
  maxDescendantDepth: number | null,
): number {
  return Math.max(node.depth, maxDescendantDepth ?? node.depth) - node.depth + 1;
}

/** Có được thêm văn bản con vào nút ở cấp `depth` không (ẩn nút "+" ở cấp cuối) */
export function canAddChild(depth: number, maxDepth = DEFAULT_MAX_TREE_DEPTH): boolean {
  return depth < maxDepth;
}

/** Kiểm tra tạo nút mới; trả câu lỗi tiếng Việt hoặc null */
export function validateCreate(options: {
  parent: LabeledPos | null;
  typeIsProgram: boolean;
  maxDepth?: number;
}): string | null {
  const { parent, typeIsProgram, maxDepth = DEFAULT_MAX_TREE_DEPTH } = options;
  if (!parent) return typeIsProgram ? null : "Văn bản cấp 1 phải thuộc loại “Chương trình”.";
  if (!canAddChild(parent.depth, maxDepth)) {
    return `Không thể thêm văn bản con: “${parent.label}” đã ở cấp ${parent.depth}, cây chỉ có tối đa ${maxDepth} cấp.`;
  }
  return null;
}

/** Kiểm tra di chuyển nút (cùng cả nhánh của nó) sang cha mới; trả câu lỗi tiếng Việt hoặc null */
export function validateMove(options: {
  node: LabeledPos;
  nodeIsProgram: boolean;
  /** Cấp sâu nhất trong nhánh của nút (null nếu không có con) */
  maxDescendantDepth: number | null;
  newParent: LabeledPos | null;
  maxDepth?: number;
}): string | null {
  const {
    node,
    nodeIsProgram,
    maxDescendantDepth,
    newParent,
    maxDepth = DEFAULT_MAX_TREE_DEPTH,
  } = options;
  if (newParent) {
    if (newParent.id === node.id) return "Không thể chuyển văn bản vào chính nó.";
    if (isInSubtree(node, newParent)) {
      return `Không thể chuyển “${node.label}” vào “${newParent.label}” vì đó là văn bản con/cháu của chính nó.`;
    }
  } else if (!nodeIsProgram) {
    return `Chỉ văn bản loại “Chương trình” mới đặt được ở cấp 1.`;
  }
  const height = subtreeHeight(node, maxDescendantDepth);
  const newDepth = (newParent?.depth ?? 0) + 1;
  const deepest = newDepth + height - 1;
  if (deepest > maxDepth) {
    const where = newParent ? `vào “${newParent.label}” (cấp ${newParent.depth})` : "lên cấp 1";
    return (
      `Không thể chuyển: nhánh “${node.label}” có ${height} cấp, đặt ${where} thì nhánh sẽ xuống tới cấp ${deepest}, ` +
      `vượt quá tối đa ${maxDepth} cấp.`
    );
  }
  return null;
}

export type NodeUpdate = { id: string; path: string; depth: number; rootId: string | null };

/**
 * Tính lại path/depth/rootId cho nút và TOÀN BỘ con cháu khi chuyển sang cha mới.
 * `descendants`: mọi nút có path bắt đầu bằng path của nút (không gồm chính nó), kể cả nút đã xoá mềm.
 */
export function planMove(
  node: TreePos,
  descendants: readonly TreePos[],
  newParent: TreePos | null,
): NodeUpdate[] {
  const placed = placementUnder(newParent, node.id);
  const depthDelta = placed.depth - node.depth;
  // Gốc mới của nhánh: nếu nút thành cấp 1 thì con cháu lấy chính nó làm gốc
  const subtreeRoot = placed.rootId ?? node.id;
  const updates: NodeUpdate[] = [
    { id: node.id, path: placed.path, depth: placed.depth, rootId: placed.rootId },
  ];
  for (const d of descendants) {
    if (d.id === node.id) continue;
    if (!d.path.startsWith(node.path))
      throw new Error(`Nút ${d.id} không thuộc nhánh của ${node.id}`);
    updates.push({
      id: d.id,
      path: placed.path + d.path.slice(node.path.length),
      depth: d.depth + depthDelta,
      rootId: subtreeRoot,
    });
  }
  return updates;
}

/** Thứ tự mới (sortOrder 1..n) khi đặt `movedId` vào vị trí `index` trong danh sách anh em */
export function planReorder(
  siblingIds: readonly string[],
  movedId: string,
  index: number,
): { id: string; sortOrder: number }[] {
  const others = siblingIds.filter((id) => id !== movedId);
  const at = Math.max(0, Math.min(index, others.length));
  const ordered = [...others.slice(0, at), movedId, ...others.slice(at)];
  return ordered.map((id, i) => ({ id, sortOrder: i + 1 }));
}

// ---------------------------------------------------------------- Kéo-thả

export type DropIntent = "before" | "inside" | "after";

/**
 * Vùng thả trên một dòng cây: 1/4 trên → chèn trước, 1/4 dưới → chèn sau, giữa → làm con.
 * `allowInside` = false (nút đã ở cấp cuối) → chia đôi trước/sau.
 */
export function dropIntent(
  rowTop: number,
  rowHeight: number,
  pointerY: number,
  allowInside = true,
): DropIntent {
  const offset = (pointerY - rowTop) / Math.max(rowHeight, 1);
  if (!allowInside) return offset < 0.5 ? "before" : "after";
  if (offset < 0.25) return "before";
  if (offset > 0.75) return "after";
  return "inside";
}

/**
 * Đổi ý định thả thành (cha mới, vị trí). `targetSiblingIds`: anh em của nút đích theo thứ tự hiện tại
 * (gồm cả nút đích). `childCount`: số con hiện có của nút đích (thả vào trong → đặt cuối).
 */
export function resolveDrop(options: {
  intent: DropIntent;
  target: { id: string; parentId: string | null };
  targetSiblingIds: readonly string[];
  targetChildIds: readonly string[];
  movedId: string;
}): { newParentId: string | null; index: number } {
  const { intent, target, targetSiblingIds, targetChildIds, movedId } = options;
  if (intent === "inside") {
    return { newParentId: target.id, index: targetChildIds.filter((id) => id !== movedId).length };
  }
  const siblings = targetSiblingIds.filter((id) => id !== movedId);
  const at = siblings.indexOf(target.id);
  return { newParentId: target.parentId, index: intent === "before" ? at : at + 1 };
}

// ---------------------------------------------------------------- Hiển thị

export type SortMode = "manual" | "issuedDate";

/** Sắp anh em: thủ công (sortOrder) hoặc theo ngày ban hành mới nhất trước */
export function sortSiblings<
  T extends { sortOrder: number; issuedDate: Date | string | null; title: string },
>(nodes: readonly T[], mode: SortMode): T[] {
  const time = (d: Date | string | null) => (d ? new Date(d).getTime() : -Infinity);
  return [...nodes].sort((a, b) =>
    mode === "issuedDate"
      ? time(b.issuedDate) - time(a.issuedDate) || a.sortOrder - b.sortOrder
      : a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, "vi"),
  );
}
