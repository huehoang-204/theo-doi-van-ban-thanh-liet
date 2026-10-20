import { describe, expect, it } from "vitest";

import { getNavBreadcrumb, isActivePath } from "@/lib/nav";

describe("menu & breadcrumb", () => {
  it("'/' chỉ khớp chính nó", () => {
    expect(isActivePath("/", "/")).toBe(true);
    expect(isActivePath("/", "/van-ban")).toBe(false);
  });

  it("khớp trang con nhưng không khớp tiền tố trùng tên", () => {
    expect(isActivePath("/van-ban", "/van-ban/abc")).toBe(true);
    expect(isActivePath("/van-ban", "/van-ban-khac")).toBe(false);
  });

  it("breadcrumb mục đơn và mục nhóm", () => {
    expect(getNavBreadcrumb("/")).toEqual([{ label: "Bảng điều hành", href: "/" }]);
    expect(getNavBreadcrumb("/dia-ban/truong-hoc")).toEqual([
      { label: "Địa bàn" },
      { label: "Trường học", href: "/dia-ban/truong-hoc" },
    ]);
    expect(getNavBreadcrumb("/cong-viec/xyz")).toEqual([
      { label: "Công việc", href: "/cong-viec" },
    ]);
    expect(getNavBreadcrumb("/khong-ton-tai")).toEqual([]);
  });
});
