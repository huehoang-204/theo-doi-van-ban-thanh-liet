"use server";

import { z } from "zod";

import {
  departmentSchema,
  documentTypeSchema,
  fieldSchema,
  issuingAgencySchema,
  oldAreaSchema,
} from "@/lib/schemas/catalog";
import { withAuth } from "@/server/action";
import { AppError } from "@/server/errors";

const idSchema = z.object({ id: z.string().min(1) });
const CATALOG_PATH = "/quan-tri/danh-muc";

// ---------- Đơn vị ----------
export const saveDepartment = withAuth(
  { permission: "department.manage", schema: departmentSchema, revalidate: ["/quan-tri/don-vi"] },
  async ({ tx, input: { id, ...data }, audit }) => {
    if (id) {
      const before = await tx.department.findUniqueOrThrow({ where: { id } });
      const after = await tx.department.update({ where: { id }, data });
      audit({ action: "UPDATE", entity: "Department", entityId: id, before, after });
      return after.id;
    }
    const created = await tx.department.create({ data });
    audit({ action: "CREATE", entity: "Department", entityId: created.id, after: created });
    return created.id;
  },
);

export const deleteDepartment = withAuth(
  { permission: "department.manage", schema: idSchema, revalidate: ["/quan-tri/don-vi"] },
  async ({ tx, input: { id }, audit }) => {
    // Các tham chiếu dạng mảng id không có khoá ngoại → kiểm tra tay
    const [docs, tasks, requirements] = await Promise.all([
      tx.documentNode.count({ where: { coDepartmentIds: { has: id } } }),
      tx.task.count({ where: { coDepartmentIds: { has: id } } }),
      tx.reportRequirement.count({ where: { departmentIds: { has: id } } }),
    ]);
    if (docs + tasks + requirements > 0) {
      throw new AppError(
        "IN_USE",
        "Không thể xoá vì đơn vị đang được gắn với văn bản/công việc/báo cáo. Hãy chuyển sang “Ngừng sử dụng”.",
      );
    }
    const before = await tx.department.delete({ where: { id } });
    audit({ action: "DELETE", entity: "Department", entityId: id, before });
    return id;
  },
);

// ---------- Loại văn bản ----------
export const saveDocumentType = withAuth(
  { permission: "catalog.manage", schema: documentTypeSchema, revalidate: [CATALOG_PATH] },
  async ({ tx, input: { id, ...data }, audit }) => {
    if (id) {
      const before = await tx.documentType.findUniqueOrThrow({ where: { id } });
      const after = await tx.documentType.update({ where: { id }, data });
      audit({ action: "UPDATE", entity: "DocumentType", entityId: id, before, after });
      return id;
    }
    const created = await tx.documentType.create({ data });
    audit({ action: "CREATE", entity: "DocumentType", entityId: created.id, after: created });
    return created.id;
  },
);

export const deleteDocumentType = withAuth(
  { permission: "catalog.manage", schema: idSchema, revalidate: [CATALOG_PATH] },
  async ({ tx, input: { id }, audit }) => {
    const before = await tx.documentType.delete({ where: { id } });
    audit({ action: "DELETE", entity: "DocumentType", entityId: id, before });
    return id;
  },
);

// ---------- Lĩnh vực ----------
export const saveField = withAuth(
  { permission: "catalog.manage", schema: fieldSchema, revalidate: [CATALOG_PATH] },
  async ({ tx, input: { id, ...data }, audit }) => {
    if (id) {
      const before = await tx.field.findUniqueOrThrow({ where: { id } });
      const after = await tx.field.update({ where: { id }, data });
      audit({ action: "UPDATE", entity: "Field", entityId: id, before, after });
      return id;
    }
    const created = await tx.field.create({ data });
    audit({ action: "CREATE", entity: "Field", entityId: created.id, after: created });
    return created.id;
  },
);

export const deleteField = withAuth(
  { permission: "catalog.manage", schema: idSchema, revalidate: [CATALOG_PATH] },
  async ({ tx, input: { id }, audit }) => {
    const before = await tx.field.delete({ where: { id } });
    audit({ action: "DELETE", entity: "Field", entityId: id, before });
    return id;
  },
);

// ---------- Cơ quan ban hành / nơi nhận ----------
export const saveIssuingAgency = withAuth(
  { permission: "catalog.manage", schema: issuingAgencySchema, revalidate: [CATALOG_PATH] },
  async ({ tx, input: { id, ...data }, audit }) => {
    if (id) {
      const before = await tx.issuingAgency.findUniqueOrThrow({ where: { id } });
      const after = await tx.issuingAgency.update({ where: { id }, data });
      audit({ action: "UPDATE", entity: "IssuingAgency", entityId: id, before, after });
      return id;
    }
    const created = await tx.issuingAgency.create({ data });
    audit({ action: "CREATE", entity: "IssuingAgency", entityId: created.id, after: created });
    return created.id;
  },
);

export const deleteIssuingAgency = withAuth(
  { permission: "catalog.manage", schema: idSchema, revalidate: [CATALOG_PATH] },
  async ({ tx, input: { id }, audit }) => {
    const before = await tx.issuingAgency.delete({ where: { id } });
    audit({ action: "DELETE", entity: "IssuingAgency", entityId: id, before });
    return id;
  },
);

// ---------- Khu vực cũ ----------
export const saveOldArea = withAuth(
  {
    permission: "catalog.manage",
    schema: oldAreaSchema,
    revalidate: [CATALOG_PATH, "/dia-ban/to-dan-pho"],
  },
  async ({ tx, input: { id, ...data }, audit }) => {
    if (id) {
      const before = await tx.oldArea.findUniqueOrThrow({ where: { id } });
      const after = await tx.oldArea.update({ where: { id }, data });
      audit({ action: "UPDATE", entity: "OldArea", entityId: id, before, after });
      return id;
    }
    const created = await tx.oldArea.create({ data });
    audit({ action: "CREATE", entity: "OldArea", entityId: created.id, after: created });
    return created.id;
  },
);

export const deleteOldArea = withAuth(
  { permission: "catalog.manage", schema: idSchema, revalidate: [CATALOG_PATH] },
  async ({ tx, input: { id }, audit }) => {
    const before = await tx.oldArea.delete({ where: { id } });
    audit({ action: "DELETE", entity: "OldArea", entityId: id, before });
    return id;
  },
);
