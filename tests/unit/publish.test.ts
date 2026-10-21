import { describe, expect, it } from "vitest";

import { excerpt, groupByDay, hasRecipients, publishTitle, resolveRecipients } from "@/lib/publish";

const users = [
  { id: "a1", departmentId: "A", active: true },
  { id: "a2", departmentId: "A", active: true },
  { id: "a3", departmentId: "A", active: false }, // đã khoá
  { id: "b1", departmentId: "B", active: true },
  { id: "x", departmentId: null, active: true },
  { id: "me", departmentId: "A", active: true }, // người gửi
];

describe("người nhận khi ban hành", () => {
  it("theo đơn vị + đích danh, bỏ tài khoản khoá và người gửi, không trùng", () => {
    const r = resolveRecipients(
      { all: false, departmentIds: ["A"], userIds: ["b1", "a1"] },
      users,
      "me",
    );
    expect(r.userIds).toEqual(["a1", "a2", "b1"]);
    expect([...r.direct]).toEqual(["b1", "a1"]);
  });

  it("toàn phường: mọi tài khoản đang hoạt động trừ người gửi", () => {
    expect(
      resolveRecipients({ all: true, departmentIds: [], userIds: [] }, users, "me").userIds,
    ).toEqual(["a1", "a2", "b1", "x"]);
  });

  it("phải chọn ít nhất một người nhận", () => {
    expect(hasRecipients({ all: false, departmentIds: [], userIds: [] })).toBe(false);
    expect(hasRecipients({ all: false, departmentIds: [], userIds: ["x"] })).toBe(true);
  });
});

describe("nội dung thông báo ban hành", () => {
  it("như hệ thống văn bản điều hành: ĐƠN VỊ đã ban hành văn bản <loại> <trích yếu> [số]", () => {
    expect(
      publishTitle({
        sender: "Phòng Văn hóa – Xã hội",
        typeName: "Quyết định",
        title: "V/v: Mức khen thưởng năm học 2025-2026",
        number: "15/QĐ-UBND",
      }),
    ).toBe(
      "PHÒNG VĂN HÓA – XÃ HỘI đã ban hành văn bản Quyết định V/v: Mức khen thưởng năm học 2025-2026 [15/QĐ-UBND]",
    );
  });

  it("trích yếu bắt đầu bằng tên loại thì không lặp; không có số thì bỏ ngoặc", () => {
    expect(
      publishTitle({
        sender: "Văn phòng HĐND và UBND",
        typeName: "Kế hoạch",
        title: "Kế hoạch triển khai chuyển đổi số",
        number: null,
      }),
    ).toBe("VĂN PHÒNG HĐND VÀ UBND đã ban hành văn bản Kế hoạch triển khai chuyển đổi số");
  });
});

describe("danh sách văn bản mới ban hành", () => {
  const vn = (iso: string) => new Date(`${iso}+07:00`);
  it("nhóm theo ngày giờ VN, mới nhất trước, nhãn Hôm nay / Hôm qua / N ngày trước", () => {
    const now = vn("2026-10-21T09:00:00");
    const groups = groupByDay(
      [
        { id: "1", publishedAt: vn("2026-10-20T14:17:00") },
        { id: "2", publishedAt: vn("2026-10-21T00:30:00") }, // 17:30 UTC ngày 20 nhưng là sáng 21 ở VN
        { id: "3", publishedAt: vn("2026-10-21T08:00:00") },
        { id: "4", publishedAt: vn("2026-10-15T10:00:00") },
      ],
      now,
    );
    expect(groups.map((g) => [g.label, g.relative, g.items.map((i) => i.id)])).toEqual([
      ["21/10/2026", "Hôm nay", ["3", "2"]],
      ["20/10/2026", "Hôm qua", ["1"]],
      ["15/10/2026", "6 ngày trước", ["4"]],
    ]);
  });

  it("trích đoạn bình luận", () => {
    expect(excerpt("  Đề nghị   các đơn vị\nthực hiện  ")).toBe("Đề nghị các đơn vị thực hiện");
    expect(excerpt("a".repeat(100), 10)).toBe("aaaaaaaaa…");
  });
});
