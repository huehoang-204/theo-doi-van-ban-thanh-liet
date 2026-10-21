import { describe, expect, it } from "vitest";

import {
  actionLabel,
  auditDetails,
  auditEntityHref,
  auditSubject,
  entityLabel,
  formatAuditValue,
} from "@/lib/audit-labels";

describe("nhật ký — nhãn & tóm tắt", () => {
  it("nhãn tiếng Việt, mã lạ giữ nguyên", () => {
    expect(actionLabel("PURGE")).toBe("Xoá vĩnh viễn");
    expect(entityLabel("DocumentNode")).toBe("Văn bản");
    expect(entityLabel("residentials")).toBe("Tổ dân phố (Excel)");
    expect(actionLabel("XYZ")).toBe("XYZ");
  });

  it("tên đối tượng: số + trích yếu, hoặc tên / tên tệp", () => {
    expect(auditSubject({ number: "45/QĐ-UBND", title: "Thành lập tổ công tác" }, null)).toBe(
      "45/QĐ-UBND — Thành lập tổ công tác",
    );
    expect(auditSubject(null, { fileName: "ke-hoach.pdf" })).toBe("ke-hoach.pdf");
    expect(auditSubject(null, { title: "20/KH-UBND Kế hoạch", number: "20/KH-UBND" })).toBe(
      "20/KH-UBND Kế hoạch",
    );
    expect(auditSubject(null, null)).toBeNull();
  });

  it("định dạng giá trị: ngày thuần, mốc giờ VN, đúng/sai, số, mảng", () => {
    expect(formatAuditValue("2026-10-24T00:00:00.000Z")).toBe("24/10/2026");
    expect(formatAuditValue("2026-10-20T09:15:14.041Z")).toBe("20/10/2026 16:15");
    expect(formatAuditValue(true)).toBe("Có");
    expect(formatAuditValue(92000)).toBe("92.000");
    expect(formatAuditValue(["a", "b"])).toBe("a, b");
    expect(formatAuditValue(null)).toBe("—");
  });

  it("sửa: chỉ liệt kê trường thay đổi (cũ → mới), bỏ trường kỹ thuật", () => {
    expect(
      auditDetails(
        {
          title: "A",
          progress: 20,
          updatedAt: "2026-10-01T01:00:00Z",
          dueDate: "2026-10-24T00:00:00.000Z",
        },
        {
          title: "A",
          progress: 60,
          updatedAt: "2026-10-02T01:00:00Z",
          dueDate: "2026-10-31T00:00:00.000Z",
        },
      ),
    ).toEqual([
      { field: "progress", label: "Tiến độ (%)", before: "20", after: "60" },
      { field: "dueDate", label: "Hạn", before: "24/10/2026", after: "31/10/2026" },
    ]);
  });

  it("thêm/xoá: liệt kê giá trị một bên; liên kết tới trang đối tượng (trừ khi đã xoá vĩnh viễn)", () => {
    expect(
      auditDetails(null, { id: "x", name: "Phòng Kinh tế", active: true, note: null }),
    ).toEqual([
      { field: "name", label: "Tên", after: "Phòng Kinh tế" },
      { field: "active", label: "Đang hoạt động", after: "Có" },
    ]);
    expect(auditEntityHref("DocumentNode", "abc", "UPDATE")).toBe("/van-ban/abc");
    expect(auditEntityHref("DocumentNode", "abc", "PURGE")).toBeNull();
    expect(auditEntityHref("Setting", null, "UPDATE")).toBeNull();
  });
});
