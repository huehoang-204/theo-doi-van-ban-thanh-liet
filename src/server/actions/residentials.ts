"use server";

import { z } from "zod";

import { residentialSchema } from "@/lib/schemas/catalog";
import { withAuth } from "@/server/action";

const PATHS = ["/dia-ban/to-dan-pho", "/dia-ban/thong-tin-phuong", "/"];

export const saveResidential = withAuth(
  { permission: "residential.manage", schema: residentialSchema, revalidate: PATHS },
  async ({ tx, user, input: { id, ...fields }, audit }) => {
    const data = { ...fields, updatedById: user.id };
    if (id) {
      const before = await tx.residential.findUniqueOrThrow({ where: { id } });
      const after = await tx.residential.update({ where: { id }, data });
      audit({ action: "UPDATE", entity: "Residential", entityId: id, before, after });
      return id;
    }
    const created = await tx.residential.create({ data });
    audit({ action: "CREATE", entity: "Residential", entityId: created.id, after: created });
    return created.id;
  },
);

export const deleteResidential = withAuth(
  {
    permission: "residential.manage",
    schema: z.object({ id: z.string().min(1) }),
    revalidate: PATHS,
  },
  async ({ tx, input: { id }, audit }) => {
    const before = await tx.residential.delete({ where: { id } });
    audit({ action: "DELETE", entity: "Residential", entityId: id, before });
    return id;
  },
);
