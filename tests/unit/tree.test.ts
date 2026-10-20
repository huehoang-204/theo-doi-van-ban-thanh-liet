import { describe, expect, it } from "vitest";

import {
  ancestorIds,
  canAddChild,
  dropIntent,
  isInSubtree,
  pathIds,
  placementUnder,
  planMove,
  planReorder,
  resolveDrop,
  sortSiblings,
  subtreeHeight,
  validateCreate,
  validateMove,
  type LabeledPos,
  type TreePos,
} from "@/lib/tree";

/** Dựng nhanh một nút từ chuỗi id các cấp: node("A","B","C") = C dưới B dưới A */
function node(...ids: string[]): LabeledPos {
  const id = ids.at(-1)!;
  return {
    id,
    path: `/${ids.join("/")}/`,
    depth: ids.length,
    rootId: ids.length > 1 ? ids[0]! : null,
    label: id,
  };
}

describe("vị trí nút mới", () => {
  it("cấp 1: path /id/, không có gốc", () => {
    expect(placementUnder(null, "A")).toEqual({
      parentId: null,
      path: "/A/",
      depth: 1,
      rootId: null,
    });
  });

  it("dưới cha: nối path, tăng cấp, gốc = gốc của cha (hoặc chính cha nếu cha là gốc)", () => {
    expect(placementUnder(node("A"), "B")).toEqual({
      parentId: "A",
      path: "/A/B/",
      depth: 2,
      rootId: "A",
    });
    expect(placementUnder(node("A", "B", "C"), "D")).toEqual({
      parentId: "C",
      path: "/A/B/C/D/",
      depth: 4,
      rootId: "A",
    });
  });

  it("đường dẫn, tổ tiên, nhánh con", () => {
    expect(pathIds("/A/B/C/")).toEqual(["A", "B", "C"]);
    expect(ancestorIds("/A/B/C/")).toEqual(["A", "B"]);
    expect(ancestorIds("/A/")).toEqual([]);
    expect(isInSubtree(node("A", "B"), node("A", "B", "C"))).toBe(true);
    expect(isInSubtree(node("A", "B"), node("A", "B"))).toBe(true);
    expect(isInSubtree(node("A", "B"), node("A", "X"))).toBe(false);
    // Không nhầm tiền tố chuỗi: "/A/B/" không chứa "/A/BC/"
    expect(isInSubtree(node("A", "B"), node("A", "BC"))).toBe(false);
  });
});

describe("tạo nút — giới hạn 5 cấp, cấp 1 là Chương trình", () => {
  it("cấp 1 bắt buộc loại Chương trình", () => {
    expect(validateCreate({ parent: null, typeIsProgram: true })).toBeNull();
    expect(validateCreate({ parent: null, typeIsProgram: false })).toBe(
      "Văn bản cấp 1 phải thuộc loại “Chương trình”.",
    );
  });

  it("cấp 2–5 chọn loại bất kỳ; tạo được đủ 5 cấp", () => {
    let parent: LabeledPos | null = null;
    const ids = ["CT", "KH", "QD", "QC", "BC"];
    for (const [i, id] of ids.entries()) {
      expect(validateCreate({ parent, typeIsProgram: i === 0 })).toBeNull();
      parent = { ...placementUnder(parent, id), id, label: id };
    }
    expect(parent!.depth).toBe(5);
  });

  it("nút cấp 5 không thêm con được (nút “+” ẩn)", () => {
    expect(canAddChild(4)).toBe(true);
    expect(canAddChild(5)).toBe(false);
    expect(validateCreate({ parent: node("A", "B", "C", "D", "E"), typeIsProgram: false })).toBe(
      "Không thể thêm văn bản con: “E” đã ở cấp 5, cây chỉ có tối đa 5 cấp.",
    );
  });

  it("giới hạn cấp cấu hình được", () => {
    expect(canAddChild(5, 6)).toBe(true);
    expect(
      validateCreate({ parent: node("A", "B", "C"), typeIsProgram: false, maxDepth: 3 }),
    ).not.toBeNull();
  });
});

describe("di chuyển — kiểm tra hợp lệ", () => {
  it("số cấp của nhánh", () => {
    expect(subtreeHeight({ depth: 3 }, null)).toBe(1);
    expect(subtreeHeight({ depth: 2 }, 4)).toBe(3);
  });

  it("nghiệm thu GĐ2: kéo nhánh 3 cấp vào nút cấp 3 bị từ chối với thông báo rõ", () => {
    const branch = node("P", "X"); // cấp 2, nhánh xuống tới cấp 4 → 3 cấp
    const target = node("Q", "R", "S"); // cấp 3
    expect(
      validateMove({
        node: branch,
        nodeIsProgram: false,
        maxDescendantDepth: 4,
        newParent: target,
      }),
    ).toBe(
      "Không thể chuyển: nhánh “X” có 3 cấp, đặt vào “S” (cấp 3) thì nhánh sẽ xuống tới cấp 6, vượt quá tối đa 5 cấp.",
    );
  });

  it("vừa khít 5 cấp thì được: nhánh 3 cấp vào nút cấp 2", () => {
    expect(
      validateMove({
        node: node("P", "X"),
        nodeIsProgram: false,
        maxDescendantDepth: 4,
        newParent: node("Q", "R"),
      }),
    ).toBeNull();
  });

  it("chặn chuyển vào chính nó hoặc con cháu của nó", () => {
    const n = node("A", "B");
    expect(
      validateMove({ node: n, nodeIsProgram: false, maxDescendantDepth: 4, newParent: n }),
    ).toBe("Không thể chuyển văn bản vào chính nó.");
    expect(
      validateMove({
        node: n,
        nodeIsProgram: false,
        maxDescendantDepth: 4,
        newParent: node("A", "B", "C", "D"),
      }),
    ).toBe("Không thể chuyển “B” vào “D” vì đó là văn bản con/cháu của chính nó.");
  });

  it("chỉ Chương trình mới lên cấp 1 được", () => {
    expect(
      validateMove({
        node: node("A", "B"),
        nodeIsProgram: false,
        maxDescendantDepth: null,
        newParent: null,
      }),
    ).toBe("Chỉ văn bản loại “Chương trình” mới đặt được ở cấp 1.");
    expect(
      validateMove({
        node: node("A", "B"),
        nodeIsProgram: true,
        maxDescendantDepth: 3,
        newParent: null,
      }),
    ).toBeNull();
  });

  it("chuyển trong cùng chương trình sang nhánh khác cùng cấp", () => {
    expect(
      validateMove({
        node: node("A", "B", "C"),
        nodeIsProgram: false,
        maxDescendantDepth: 5,
        newParent: node("A", "D"),
      }),
    ).toBeNull();
  });
});

describe("di chuyển — cập nhật path cho cả cây con", () => {
  const A = node("A");
  const B = node("A", "B");
  const C = node("A", "B", "C");
  const D = node("A", "B", "C", "D");
  const E = node("A", "B", "E");
  const subtree: TreePos[] = [C, D, E];

  it("chuyển B (cùng C, D, E) sang chương trình khác Z", () => {
    const Z = node("Z");
    expect(planMove(B, subtree, Z)).toEqual([
      { id: "B", path: "/Z/B/", depth: 2, rootId: "Z" },
      { id: "C", path: "/Z/B/C/", depth: 3, rootId: "Z" },
      { id: "D", path: "/Z/B/C/D/", depth: 4, rootId: "Z" },
      { id: "E", path: "/Z/B/E/", depth: 3, rootId: "Z" },
    ]);
  });

  it("chuyển lên sâu hơn: B vào dưới Y (cấp 2) → cấp cả nhánh tăng 1", () => {
    const Y = node("Z", "Y");
    const plan = planMove(B, subtree, Y);
    expect(plan.map((u) => [u.id, u.path, u.depth, u.rootId])).toEqual([
      ["B", "/Z/Y/B/", 3, "Z"],
      ["C", "/Z/Y/B/C/", 4, "Z"],
      ["D", "/Z/Y/B/C/D/", 5, "Z"],
      ["E", "/Z/Y/B/E/", 4, "Z"],
    ]);
  });

  it("đưa lên cấp 1: nút thành gốc (rootId null), con cháu lấy nó làm gốc", () => {
    expect(planMove(B, subtree, null)).toEqual([
      { id: "B", path: "/B/", depth: 1, rootId: null },
      { id: "C", path: "/B/C/", depth: 2, rootId: "B" },
      { id: "D", path: "/B/C/D/", depth: 3, rootId: "B" },
      { id: "E", path: "/B/E/", depth: 2, rootId: "B" },
    ]);
  });

  it("chuyển gốc vào chương trình khác: con cháu đổi gốc", () => {
    const plan = planMove(A, [B, C], node("Z"));
    expect(plan.map((u) => u.rootId)).toEqual(["Z", "Z", "Z"]);
    expect(plan[2]).toEqual({ id: "C", path: "/Z/A/B/C/", depth: 4, rootId: "Z" });
  });

  it("nút không thuộc nhánh → lỗi lập trình (không âm thầm ghi sai)", () => {
    expect(() => planMove(B, [node("A", "X")], null)).toThrow();
  });
});

describe("sắp xếp anh em", () => {
  it("đặt vào vị trí, đánh lại thứ tự 1..n", () => {
    expect(planReorder(["a", "b", "c", "d"], "d", 1)).toEqual([
      { id: "a", sortOrder: 1 },
      { id: "d", sortOrder: 2 },
      { id: "b", sortOrder: 3 },
      { id: "c", sortOrder: 4 },
    ]);
    expect(planReorder(["a", "b"], "x", 99).map((r) => r.id)).toEqual(["a", "b", "x"]);
    expect(planReorder(["a", "b", "c"], "a", 2).map((r) => r.id)).toEqual(["b", "c", "a"]);
  });

  it("theo ngày ban hành (mới nhất trước) hoặc thủ công", () => {
    const rows = [
      { id: "1", sortOrder: 2, issuedDate: "2026-01-12", title: "X" },
      { id: "2", sortOrder: 1, issuedDate: "2026-03-01", title: "Y" },
      { id: "3", sortOrder: 3, issuedDate: null, title: "Z" },
    ];
    expect(sortSiblings(rows, "manual").map((r) => r.id)).toEqual(["2", "1", "3"]);
    // 01/03/2026 mới nhất → 12/01/2026 → chưa có ngày xếp cuối
    expect(sortSiblings(rows, "issuedDate").map((r) => r.id)).toEqual(["2", "1", "3"]);
    expect(
      sortSiblings(
        [...rows, { id: "4", sortOrder: 0, issuedDate: "2026-02-01", title: "W" }],
        "issuedDate",
      ).map((r) => r.id),
    ).toEqual(["2", "4", "1", "3"]);
  });
});

describe("kéo-thả", () => {
  it("vùng thả: trên / giữa / dưới; nút cấp cuối chỉ có trước / sau", () => {
    expect(dropIntent(100, 40, 105)).toBe("before");
    expect(dropIntent(100, 40, 120)).toBe("inside");
    expect(dropIntent(100, 40, 135)).toBe("after");
    expect(dropIntent(100, 40, 115, false)).toBe("before");
    expect(dropIntent(100, 40, 125, false)).toBe("after");
  });

  it("thả trước / sau → cùng cha với nút đích, đúng vị trí (bỏ qua chính nút đang kéo)", () => {
    const base = {
      target: { id: "c", parentId: "P" },
      targetSiblingIds: ["a", "b", "c", "d"],
      targetChildIds: [],
      movedId: "a",
    };
    expect(resolveDrop({ ...base, intent: "before" })).toEqual({ newParentId: "P", index: 1 });
    expect(resolveDrop({ ...base, intent: "after" })).toEqual({ newParentId: "P", index: 2 });
    expect(resolveDrop({ ...base, movedId: "x", intent: "before" })).toEqual({
      newParentId: "P",
      index: 2,
    });
  });

  it("thả vào giữa → làm con cuối của nút đích", () => {
    expect(
      resolveDrop({
        intent: "inside",
        target: { id: "c", parentId: "P" },
        targetSiblingIds: ["c"],
        targetChildIds: ["k1", "k2"],
        movedId: "a",
      }),
    ).toEqual({ newParentId: "c", index: 2 });
  });
});
