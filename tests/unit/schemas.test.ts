import { describe, expect, it } from "vitest";

import {
  partyOrgSchema,
  residentialSchema,
  schoolYearStatSchema,
  wardProfileSchema,
} from "@/lib/schemas/catalog";
import { parseViDate, toNumber } from "@/lib/schemas/common";

describe("đọc số kiểu Việt", () => {
  it("dấu chấm nghìn, dấu phẩy thập phân", () => {
    expect(toNumber("92.000")).toBe(92000);
    expect(toNumber("1.234.567")).toBe(1234567);
    expect(toNumber("6,44")).toBe(6.44);
    expect(toNumber("1.234,5")).toBe(1234.5);
  });
  it("dấu chấm thập phân khi không phải nhóm nghìn", () => {
    expect(toNumber("21.03")).toBe(21.03);
    expect(toNumber("105.8")).toBe(105.8);
  });
  it("ô trống → null; chữ → NaN (để báo lỗi)", () => {
    expect(toNumber("")).toBeNull();
    expect(toNumber("  ")).toBeNull();
    expect(Number.isNaN(toNumber("abc"))).toBe(true);
  });
});

describe("ngày dd/mm/yyyy", () => {
  it("ngày hợp lệ → 00:00 UTC", () => {
    expect(parseViDate("01/07/2025")?.toISOString()).toBe("2025-07-01T00:00:00.000Z");
    expect(parseViDate("29/02/2028")?.toISOString()).toBe("2028-02-29T00:00:00.000Z");
  });
  it("ngày không có thật / sai dạng → null", () => {
    expect(parseViDate("29/02/2026")).toBeNull();
    expect(parseViDate("31/04/2026")).toBeNull();
    expect(parseViDate("2026-07-01")).toBeNull();
  });
});

describe("schema danh mục", () => {
  it("TDP: ô trống thành null, số kiểu Việt được chấp nhận", () => {
    const r = residentialSchema.parse({
      name: " Tổ dân phố số 1 ",
      code: "1",
      oldAreaId: "",
      leaderName: "",
      leaderPhone: "",
      households: "1.250",
      population: "4.100",
      partyOrgId: "",
      note: "",
      active: true,
    });
    expect(r).toMatchObject({
      name: "Tổ dân phố số 1",
      households: 1250,
      population: 4100,
      oldAreaId: null,
    });
  });

  it("TDP: báo lỗi tiếng Việt cho số âm, số lẻ, chữ", () => {
    const r = residentialSchema.safeParse({
      name: "TDP",
      households: "-1",
      population: "3,5",
      active: true,
    });
    const msgs = r.error?.issues.map((i) => i.message);
    expect(msgs).toContain("Số hộ không được âm.");
    expect(msgs).toContain("Số nhân khẩu phải là số nguyên.");
    expect(residentialSchema.safeParse({ name: "", active: true }).error?.issues[0]?.message).toBe(
      "Vui lòng nhập tên tổ dân phố.",
    );
  });

  it("số liệu năm học: kiểm tra năm học, học sinh nữ ≤ tổng, tổng CB-GV-NV", () => {
    const base = { schoolId: "s1", schoolYear: "2026-2027", staffTotal: "50", students: "800" };
    expect(schoolYearStatSchema.safeParse(base).success).toBe(true);
    expect(schoolYearStatSchema.safeParse({ ...base, schoolYear: "2026-2028" }).success).toBe(
      false,
    );
    expect(
      schoolYearStatSchema.safeParse({ ...base, femaleStudents: "900" }).error?.issues[0]?.message,
    ).toBe("Số học sinh nữ không được lớn hơn tổng số học sinh.");
    expect(
      schoolYearStatSchema.safeParse({ ...base, teachers: "40", employees: "20" }).success,
    ).toBe(false);
    expect(
      schoolYearStatSchema.safeParse({ ...base, students: "" }).error?.issues[0]?.message,
    ).toBe("Vui lòng nhập số học sinh.");
  });

  it("tổ chức đảng: tổng = chính thức + dự bị", () => {
    const base = {
      name: "Chi bộ TDP 1",
      type: "CHI_BO_CO_SO",
      block: "KHU_DAN_CU",
      memberCount: "30",
      active: true,
    };
    expect(partyOrgSchema.safeParse(base).success).toBe(true);
    expect(
      partyOrgSchema.safeParse({ ...base, officialMembers: "28", probationaryMembers: "2" })
        .success,
    ).toBe(true);
    expect(
      partyOrgSchema.safeParse({ ...base, officialMembers: "20", probationaryMembers: "2" })
        .success,
    ).toBe(false);
  });

  it("thông tin phường: diện tích 6,44 và ngày thành lập", () => {
    const r = wardProfileSchema.parse({
      name: "Phường Thanh Liệt",
      city: "Hà Nội",
      areaKm2: "6,44",
      population: "92.000",
      populationIsEstimate: true,
      establishedDate: "01/07/2025",
    });
    expect(r.areaKm2).toBe(6.44);
    expect(r.population).toBe(92000);
    expect(r.establishedDate?.toISOString()).toBe("2025-07-01T00:00:00.000Z");
    expect(
      wardProfileSchema.safeParse({
        name: "P",
        city: "HN",
        areaKm2: "6",
        population: "1",
        establishedDate: "31/02/2025",
      }).error?.issues[0]?.message,
    ).toBe("Ngày thành lập phải có dạng dd/mm/yyyy và là ngày có thật.");
  });
});
