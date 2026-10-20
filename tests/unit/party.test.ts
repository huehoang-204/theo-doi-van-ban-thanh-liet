import { describe, expect, it } from "vitest";

import {
  computePartyStats,
  flattenTree,
  validatePartyParent,
  type PartyOrgStatInput,
} from "@/lib/party";

describe("cấp trên của tổ chức đảng", () => {
  const root = { id: "root", type: "DANG_BO_PHUONG" as const };
  const ward = { id: "bp", type: "DANG_BO_BO_PHAN" as const };
  const cell = { id: "cb", type: "CHI_BO_CO_SO" as const };

  it("Đảng bộ phường không có cấp trên", () => {
    expect(validatePartyParent("DANG_BO_PHUONG", null)).toBeNull();
    expect(validatePartyParent("DANG_BO_PHUONG", ward)).not.toBeNull();
  });

  it("chi bộ cơ sở, đảng bộ bộ phận/cơ sở trực thuộc Đảng bộ phường", () => {
    expect(validatePartyParent("CHI_BO_CO_SO", root)).toBeNull();
    expect(validatePartyParent("DANG_BO_BO_PHAN", root)).toBeNull();
    expect(validatePartyParent("CHI_BO_CO_SO", ward)).toBe(
      "Tổ chức này phải trực thuộc Đảng bộ phường.",
    );
    expect(validatePartyParent("CHI_BO_CO_SO", null)).toBe("Vui lòng chọn cấp trên trực tiếp.");
  });

  it("chi bộ trực thuộc phải thuộc đảng bộ bộ phận/cơ sở", () => {
    expect(validatePartyParent("CHI_BO_TRUC_THUOC", ward)).toBeNull();
    expect(validatePartyParent("CHI_BO_TRUC_THUOC", root)).not.toBeNull();
    expect(validatePartyParent("CHI_BO_TRUC_THUOC", cell)).not.toBeNull();
  });

  it("không chọn chính mình làm cấp trên", () => {
    expect(validatePartyParent("DANG_BO_BO_PHAN", { id: "bp", type: "DANG_BO_PHUONG" }, "bp")).toBe(
      "Không thể chọn chính tổ chức này làm cấp trên.",
    );
  });
});

describe("số liệu tổ chức đảng cho bảng điều hành", () => {
  const org = (
    over: Partial<PartyOrgStatInput> & Pick<PartyOrgStatInput, "id">,
  ): PartyOrgStatInput => ({
    parentId: "root",
    type: "CHI_BO_CO_SO",
    block: "KHU_DAN_CU",
    memberCount: 10,
    active: true,
    ...over,
  });

  const orgs: PartyOrgStatInput[] = [
    org({ id: "root", parentId: null, type: "DANG_BO_PHUONG", block: "KHAC", memberCount: 999 }),
    org({ id: "a", memberCount: 30 }),
    org({ id: "b", block: "TRUONG_HOC", memberCount: 20 }),
    org({ id: "bp", type: "DANG_BO_BO_PHAN", block: "CO_QUAN", memberCount: 50 }), // có con → không cộng
    org({ id: "c1", parentId: "bp", type: "CHI_BO_TRUC_THUOC", block: "CO_QUAN", memberCount: 25 }),
    org({ id: "c2", parentId: "bp", type: "CHI_BO_TRUC_THUOC", block: "CO_QUAN", memberCount: 25 }),
    org({ id: "off", active: false, memberCount: 100 }),
  ];

  it("đếm tổ chức trừ gốc, chi bộ, đảng viên ở lá, phân bố theo khối; bỏ qua tổ chức ngừng hoạt động", () => {
    expect(computePartyStats(orgs)).toEqual({
      orgCount: 5,
      cellCount: 4,
      memberCount: 30 + 20 + 25 + 25,
      cellsByBlock: { KHU_DAN_CU: 1, TRUONG_HOC: 1, CO_QUAN: 2 },
    });
  });

  it("làm phẳng cây: cha trước con, kèm độ sâu", () => {
    const flat = flattenTree(
      orgs.filter((o) => o.active),
      (x, y) => x.id.localeCompare(y.id),
    );
    expect(flat.map((o) => `${o.treeDepth}:${o.id}`)).toEqual([
      "0:root",
      "1:a",
      "1:b",
      "1:bp",
      "2:c1",
      "2:c2",
    ]);
  });

  it("không ghi đè trường depth sẵn có của bản ghi (VD văn bản cấp 1–5)", () => {
    const docs = [
      { id: "r", parentId: null, depth: 1 },
      { id: "k", parentId: "r", depth: 2 },
    ];
    expect(flattenTree(docs, () => 0).map((d) => [d.id, d.depth, d.treeDepth])).toEqual([
      ["r", 1, 0],
      ["k", 2, 1],
    ]);
  });
});
