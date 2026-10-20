"use server";

import { z } from "zod";

import { validatePartyParent } from "@/lib/party";
import { partyOrgSchema } from "@/lib/schemas/catalog";
import { withAuth } from "@/server/action";
import { AppError } from "@/server/errors";

const PATHS = ["/dia-ban/to-chuc-dang", "/"];

export const savePartyOrg = withAuth(
  { permission: "partyOrg.manage", schema: partyOrgSchema, revalidate: PATHS },
  async ({ tx, user, input: { id, ...fields }, audit }) => {
    const parent = fields.parentId
      ? await tx.partyOrg.findUnique({
          where: { id: fields.parentId },
          select: { id: true, type: true },
        })
      : null;
    const parentError = validatePartyParent(fields.type, parent, id);
    if (parentError) throw new AppError("INVALID_PARENT", parentError, { parentId: parentError });

    if (fields.type === "DANG_BO_PHUONG") {
      const otherRoot = await tx.partyOrg.findFirst({
        where: { type: "DANG_BO_PHUONG", NOT: { id: id ?? "" } },
      });
      if (otherRoot)
        throw new AppError("DUPLICATE_ROOT", "Chỉ có một Đảng bộ phường.", {
          type: "Chỉ có một Đảng bộ phường.",
        });
    }
    if (id) {
      // Đổi loại không được làm các tổ chức con mất hợp lệ
      const children = await tx.partyOrg.findMany({
        where: { parentId: id },
        select: { type: true },
      });
      if (children.some((c) => validatePartyParent(c.type, { id, type: fields.type }) !== null)) {
        throw new AppError(
          "INVALID_TYPE",
          "Không thể đổi loại vì các tổ chức trực thuộc sẽ không còn hợp lệ.",
          {
            type: "Không thể đổi loại vì các tổ chức trực thuộc sẽ không còn hợp lệ.",
          },
        );
      }
    }

    const data = { ...fields, updatedById: user.id };
    if (id) {
      const before = await tx.partyOrg.findUniqueOrThrow({ where: { id } });
      const after = await tx.partyOrg.update({ where: { id }, data });
      audit({ action: "UPDATE", entity: "PartyOrg", entityId: id, before, after });
      return id;
    }
    const created = await tx.partyOrg.create({ data });
    audit({ action: "CREATE", entity: "PartyOrg", entityId: created.id, after: created });
    return created.id;
  },
);

export const deletePartyOrg = withAuth(
  { permission: "partyOrg.manage", schema: z.object({ id: z.string().min(1) }), revalidate: PATHS },
  async ({ tx, input: { id }, audit }) => {
    const childCount = await tx.partyOrg.count({ where: { parentId: id } });
    if (childCount > 0) {
      throw new AppError(
        "HAS_CHILDREN",
        `Không thể xoá vì còn ${childCount} tổ chức trực thuộc. Hãy chuyển hoặc xoá các tổ chức đó trước.`,
      );
    }
    const before = await tx.partyOrg.delete({ where: { id } });
    audit({ action: "DELETE", entity: "PartyOrg", entityId: id, before });
    return id;
  },
);
