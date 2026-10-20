import { describe, expect, it } from "vitest";

import { createDocumentSchema, parseTags } from "@/lib/schemas/document";

const base = {
  typeId: "t1",
  title: "Quyết định thành lập Tổ công tác",
  issuingAgencyId: "a1",
  issuedDate: "20/01/2026",
  coDepartmentIds: [],
  tags: "",
  isInternalPublic: false,
};

describe("form văn bản (Mục 4.3)", () => {
  it("hợp lệ với các trường bắt buộc", () => {
    const r = createDocumentSchema.parse(base);
    expect(r.issuedDate?.toISOString()).toBe("2026-01-20T00:00:00.000Z");
    expect(r.urgency).toBe("NORMAL");
    expect(r.validity).toBe("ACTIVE");
    expect(r.parentId).toBeNull();
  });

  it("báo lỗi tiếng Việt cho trường bắt buộc", () => {
    const r = createDocumentSchema.safeParse({
      ...base,
      typeId: "",
      title: "",
      issuingAgencyId: "",
      issuedDate: "",
    });
    const byPath = Object.fromEntries(r.error!.issues.map((i) => [i.path.join("."), i.message]));
    expect(byPath).toMatchObject({
      typeId: "Vui lòng chọn loại văn bản.",
      title: "Vui lòng nhập trích yếu văn bản.",
    });
  });

  it("cơ quan ban hành: chọn danh mục HOẶC nhập tự do; ngày ban hành bắt buộc", () => {
    const r = createDocumentSchema.safeParse({ ...base, issuingAgencyId: "", issuedDate: "" });
    const msgs = r.error!.issues.map((i) => i.message);
    expect(msgs).toContain("Vui lòng chọn hoặc nhập cơ quan ban hành.");
    expect(msgs).toContain("Vui lòng nhập ngày ban hành.");
    expect(
      createDocumentSchema.safeParse({
        ...base,
        issuingAgencyId: "",
        issuingAgencyText: "Sở Nội vụ",
      }).success,
    ).toBe(true);
  });

  it("trích yếu tối đa 500 ký tự", () => {
    expect(
      createDocumentSchema.safeParse({ ...base, title: "a".repeat(501) }).error?.issues[0]?.message,
    ).toBe("Trích yếu văn bản tối đa 500 ký tự.");
  });

  it("bị thay thế thì phải chọn văn bản thay thế; ngày hiệu lực không trước ngày ban hành", () => {
    expect(
      createDocumentSchema.safeParse({ ...base, validity: "REPLACED" }).error?.issues[0]?.message,
    ).toBe("Vui lòng chọn văn bản thay thế.");
    expect(
      createDocumentSchema.safeParse({ ...base, effectiveDate: "19/01/2026" }).error?.issues[0]
        ?.message,
    ).toBe("Ngày hiệu lực không được trước ngày ban hành.");
  });

  it("thẻ: tách theo dấu phẩy, bỏ trùng/rỗng", () => {
    expect(parseTags("chuyển đổi số, TTHC,, chuyển đổi số ;số hoá")).toEqual([
      "chuyển đổi số",
      "TTHC",
      "số hoá",
    ]);
    expect(createDocumentSchema.parse({ ...base, tags: "a, b" }).tags).toEqual(["a", "b"]);
  });
});
