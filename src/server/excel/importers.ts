import "server-only";

import type { PartyOrgType, Prisma } from "@/generated/prisma/client";
import type { ImportKind } from "@/lib/excel/import-specs";
import type { ImportRowError, ParsedRow } from "@/lib/excel/parse";
import { validatePartyParent } from "@/lib/party";
import { normalizeForSearch } from "@/lib/text";

export type ImportSummary = { created: number; updated: number };

type Tx = Prisma.TransactionClient;
type Ctx = { tx: Tx; userId: string; errors: ImportRowError[] };

const key = (s: string) => normalizeForSearch(s);

/** Bảng tra tên → id; tên trùng nhau trong CSDL đánh dấu "ambiguous" */
function nameIndex(items: { id: string; name: string }[]) {
  const map = new Map<string, string | "ambiguous">();
  for (const i of items) map.set(key(i.name), map.has(key(i.name)) ? "ambiguous" : i.id);
  return map;
}

function lookup(
  ctx: Ctx,
  index: Map<string, string | "ambiguous">,
  name: unknown,
  row: number,
  column: string,
  catalog: string,
): string | null {
  if (typeof name !== "string" || name === "") return null;
  const id = index.get(key(name));
  if (id === undefined) {
    ctx.errors.push({
      row,
      column,
      message: `Không tìm thấy “${name}” trong danh mục ${catalog}.`,
    });
    return null;
  }
  if (id === "ambiguous") {
    ctx.errors.push({
      row,
      column,
      message: `Có nhiều mục tên “${name}” trong danh mục ${catalog} — hãy sửa tên cho khác nhau trước.`,
    });
    return null;
  }
  return id;
}

async function importSchools(ctx: Ctx, rows: ParsedRow[]): Promise<ImportSummary> {
  const existing = nameIndex(await ctx.tx.school.findMany({ select: { id: true, name: true } }));
  let created = 0;
  let updated = 0;
  for (const { data } of rows) {
    const d = data as Record<string, string | number | null>;
    const fields = {
      name: d.name as string,
      level: d.level as never,
      ownership: d.ownership as never,
      address: d.address as string | null,
      phone: d.phone as string | null,
      email: d.email as string | null,
      principal: d.principal as string | null,
      principalPhone: d.principalPhone as string | null,
      updatedById: ctx.userId,
    };
    const id = existing.get(key(fields.name));
    const school =
      typeof id === "string"
        ? (updated++, await ctx.tx.school.update({ where: { id }, data: fields }))
        : (created++, await ctx.tx.school.create({ data: fields }));
    if (d.schoolYear) {
      const stat = {
        staffTotal: d.staffTotal as number,
        classes: d.classes as number | null,
        students: d.students as number,
        femaleStudents: d.femaleStudents as number | null,
        updatedById: ctx.userId,
      };
      await ctx.tx.schoolYearStat.upsert({
        where: { schoolId_schoolYear: { schoolId: school.id, schoolYear: d.schoolYear as string } },
        update: stat,
        create: { ...stat, schoolId: school.id, schoolYear: d.schoolYear as string },
      });
    }
  }
  return { created, updated };
}

async function importResidentials(ctx: Ctx, rows: ParsedRow[]): Promise<ImportSummary> {
  const [existingList, areas, orgs] = await Promise.all([
    ctx.tx.residential.findMany({ select: { id: true, name: true } }),
    ctx.tx.oldArea.findMany({ select: { id: true, name: true } }),
    ctx.tx.partyOrg.findMany({ select: { id: true, name: true } }),
  ]);
  const existing = nameIndex(existingList);
  const areaIndex = nameIndex(areas);
  const orgIndex = nameIndex(orgs);

  const prepared = rows.map(({ row, data }) => ({
    row,
    data,
    oldAreaId: lookup(ctx, areaIndex, data.oldAreaName, row, "Khu vực cũ", "Khu vực cũ"),
    partyOrgId: lookup(ctx, orgIndex, data.partyOrgName, row, "Chi bộ phụ trách", "Tổ chức đảng"),
  }));
  if (ctx.errors.length > 0) return { created: 0, updated: 0 };

  let created = 0;
  let updated = 0;
  for (const p of prepared) {
    const d = p.data as Record<string, string | number | null>;
    const fields = {
      name: d.name as string,
      code: d.code as number | null,
      oldAreaId: p.oldAreaId,
      leaderName: d.leaderName as string | null,
      leaderPhone: d.leaderPhone as string | null,
      households: d.households as number | null,
      population: d.population as number | null,
      partyOrgId: p.partyOrgId,
      note: d.note as string | null,
      updatedById: ctx.userId,
    };
    const id = existing.get(key(fields.name));
    if (typeof id === "string") {
      await ctx.tx.residential.update({ where: { id }, data: fields });
      updated++;
    } else {
      await ctx.tx.residential.create({ data: fields });
      created++;
    }
  }
  return { created, updated };
}

async function importPartyOrgs(ctx: Ctx, rows: ParsedRow[]): Promise<ImportSummary> {
  const [orgList, residentials, schools] = await Promise.all([
    ctx.tx.partyOrg.findMany({ select: { id: true, name: true, type: true } }),
    ctx.tx.residential.findMany({ select: { id: true, name: true } }),
    ctx.tx.school.findMany({ select: { id: true, name: true } }),
  ]);
  const existing = nameIndex(orgList);
  const existingType = new Map(orgList.map((o) => [o.id, o.type]));
  const resIndex = nameIndex(residentials);
  const schoolIndex = nameIndex(schools);
  const root = orgList.find((o) => o.type === "DANG_BO_PHUONG") ?? null;
  const fileTypes = new Map(
    rows.map((r) => [key(String(r.data.name)), r.data.type as PartyOrgType]),
  );
  const fileRoot = rows.find((r) => r.data.type === "DANG_BO_PHUONG");

  // Kiểm tra cấp trên: tên trong file hoặc trong CSDL; trống = Đảng bộ phường
  const prepared = rows.map(({ row, data }) => {
    const type = data.type as PartyOrgType;
    const parentName =
      typeof data.parentName === "string" && data.parentName !== "" ? data.parentName : null;
    let parentKey: string | null = null;
    let parentType: PartyOrgType | null = null;
    if (type !== "DANG_BO_PHUONG") {
      if (parentName) {
        parentKey = key(parentName);
        const dbId = existing.get(parentKey);
        parentType =
          fileTypes.get(parentKey) ??
          (typeof dbId === "string" ? (existingType.get(dbId) ?? null) : null);
        if (dbId === "ambiguous" && !fileTypes.has(parentKey)) {
          ctx.errors.push({
            row,
            column: "Cấp trên trực tiếp",
            message: `Có nhiều tổ chức tên “${parentName}” — hãy sửa tên cho khác nhau trước.`,
          });
        } else if (!parentType) {
          ctx.errors.push({
            row,
            column: "Cấp trên trực tiếp",
            message: `Không tìm thấy tổ chức “${parentName}” trong file hoặc danh mục.`,
          });
        }
      } else if (root || fileRoot) {
        parentKey = key(root?.name ?? String(fileRoot!.data.name));
        parentType = "DANG_BO_PHUONG";
      } else {
        ctx.errors.push({
          row,
          column: "Cấp trên trực tiếp",
          message:
            "Chưa có Đảng bộ phường trong danh mục — hãy thêm dòng loại “Đảng bộ phường” hoặc ghi cấp trên.",
        });
      }
    } else if (root && key(root.name) !== key(String(data.name))) {
      ctx.errors.push({
        row,
        column: "Loại",
        message: `Đã có Đảng bộ phường “${root.name}”; chỉ được có một.`,
      });
    }
    if (parentType || type === "DANG_BO_PHUONG") {
      const msg = validatePartyParent(
        type,
        parentType ? { id: parentKey ?? "", type: parentType } : null,
      );
      if (msg) ctx.errors.push({ row, column: "Cấp trên trực tiếp", message: msg });
    }
    return {
      row,
      data,
      parentKey,
      residentialId: lookup(ctx, resIndex, data.residentialName, row, "TDP liên kết", "Tổ dân phố"),
      schoolId: lookup(ctx, schoolIndex, data.schoolName, row, "Trường liên kết", "Trường học"),
    };
  });
  if (ctx.errors.length > 0) return { created: 0, updated: 0 };

  // Lượt 1: thêm/cập nhật từng tổ chức; lượt 2: gắn cấp trên (cấp trên có thể nằm sau trong file)
  const idByKey = new Map<string, string>(
    orgList.filter((o) => existing.get(key(o.name)) === o.id).map((o) => [key(o.name), o.id]),
  );
  let created = 0;
  let updated = 0;
  for (const p of prepared) {
    const d = p.data as Record<string, string | number | null>;
    const fields = {
      name: d.name as string,
      type: d.type as PartyOrgType,
      block: d.block as never,
      secretary: d.secretary as string | null,
      secretaryPhone: d.secretaryPhone as string | null,
      deputySecretary: d.deputySecretary as string | null,
      memberCount: d.memberCount as number,
      officialMembers: d.officialMembers as number | null,
      probationaryMembers: d.probationaryMembers as number | null,
      latestRating: d.latestRating as string | null,
      ratingYear: d.ratingYear as number | null,
      residentialId: p.residentialId,
      schoolId: p.schoolId,
      updatedById: ctx.userId,
    };
    const id = idByKey.get(key(fields.name));
    if (id) {
      await ctx.tx.partyOrg.update({ where: { id }, data: fields });
      updated++;
    } else {
      const createdOrg = await ctx.tx.partyOrg.create({ data: fields });
      idByKey.set(key(fields.name), createdOrg.id);
      created++;
    }
  }
  for (const p of prepared) {
    const id = idByKey.get(key(String(p.data.name)))!;
    const parentId = p.parentKey ? (idByKey.get(p.parentKey) ?? null) : null;
    await ctx.tx.partyOrg.update({ where: { id }, data: { parentId } });
  }
  return { created, updated };
}

export const IMPORTERS: Record<
  ImportKind,
  (ctx: Ctx, rows: ParsedRow[]) => Promise<ImportSummary>
> = {
  schools: importSchools,
  residentials: importResidentials,
  "party-orgs": importPartyOrgs,
};
