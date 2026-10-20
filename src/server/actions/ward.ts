"use server";

import { partyOverrideSchema, wardProfileSchema } from "@/lib/schemas/catalog";
import { withAuth } from "@/server/action";

const WARD_PATHS = ["/dia-ban/thong-tin-phuong", "/dia-ban/to-chuc-dang", "/"];

export const updateWardProfile = withAuth(
  { permission: "ward.update", schema: wardProfileSchema, revalidate: WARD_PATHS },
  async ({ tx, user, input, audit }) => {
    const before = await tx.wardProfile.findUnique({ where: { id: 1 } });
    const data = { ...input, areaKm2: String(input.areaKm2), updatedById: user.id };
    const after = await tx.wardProfile.upsert({
      where: { id: 1 },
      update: data,
      create: { id: 1, ...data },
    });
    audit({
      action: before ? "UPDATE" : "CREATE",
      entity: "WardProfile",
      entityId: "1",
      before,
      after,
    });
    return null;
  },
);

/** Số liệu tổng hợp thủ công cho tổ chức đảng khi danh mục chưa đủ (Mục 6.4) — để trống = dùng số đếm thực */
export const updatePartyOverrides = withAuth(
  { permission: "partyStats.override", schema: partyOverrideSchema, revalidate: WARD_PATHS },
  async ({ tx, user, input, audit }) => {
    const before = await tx.wardProfile.findUniqueOrThrow({
      where: { id: 1 },
      select: {
        partyOrgCountOverride: true,
        partyCellCountOverride: true,
        partyMemberCountOverride: true,
      },
    });
    await tx.wardProfile.update({ where: { id: 1 }, data: { ...input, updatedById: user.id } });
    audit({ action: "UPDATE", entity: "WardProfile", entityId: "1", before, after: input });
    return null;
  },
);
