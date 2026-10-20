"use server";

import { z } from "zod";

import { schoolSchema, schoolYearStatSchema } from "@/lib/schemas/catalog";
import { withAuth } from "@/server/action";

const PATHS = ["/dia-ban/truong-hoc", "/"];
const idSchema = z.object({ id: z.string().min(1) });

export const saveSchool = withAuth(
  { permission: "school.manage", schema: schoolSchema, revalidate: PATHS },
  async ({ tx, user, input: { id, ...fields }, audit }) => {
    const data = { ...fields, updatedById: user.id };
    if (id) {
      const before = await tx.school.findUniqueOrThrow({ where: { id } });
      const after = await tx.school.update({ where: { id }, data });
      audit({ action: "UPDATE", entity: "School", entityId: id, before, after });
      return id;
    }
    const created = await tx.school.create({ data });
    audit({ action: "CREATE", entity: "School", entityId: created.id, after: created });
    return created.id;
  },
);

export const deleteSchool = withAuth(
  { permission: "school.manage", schema: idSchema, revalidate: PATHS },
  async ({ tx, input: { id }, audit }) => {
    const before = await tx.school.findUniqueOrThrow({ where: { id }, include: { stats: true } });
    await tx.school.delete({ where: { id } }); // số liệu năm học xoá theo (cascade)
    audit({ action: "DELETE", entity: "School", entityId: id, before });
    return id;
  },
);

export const saveSchoolYearStat = withAuth(
  { permission: "school.manage", schema: schoolYearStatSchema, revalidate: PATHS },
  async ({ tx, user, input: { id, ...fields }, audit }) => {
    const data = { ...fields, updatedById: user.id };
    if (id) {
      const before = await tx.schoolYearStat.findUniqueOrThrow({ where: { id } });
      const after = await tx.schoolYearStat.update({ where: { id }, data });
      audit({ action: "UPDATE", entity: "SchoolYearStat", entityId: id, before, after });
      return id;
    }
    const created = await tx.schoolYearStat.create({ data });
    audit({ action: "CREATE", entity: "SchoolYearStat", entityId: created.id, after: created });
    return created.id;
  },
);

export const deleteSchoolYearStat = withAuth(
  { permission: "school.manage", schema: idSchema, revalidate: PATHS },
  async ({ tx, input: { id }, audit }) => {
    const before = await tx.schoolYearStat.delete({ where: { id } });
    audit({ action: "DELETE", entity: "SchoolYearStat", entityId: id, before });
    return id;
  },
);
