import type { ImportKind } from "@/lib/excel/import-specs";
import type { Action } from "@/lib/permissions";

export const IMPORT_PERMISSIONS: Record<ImportKind, Action> = {
  schools: "school.manage",
  residentials: "residential.manage",
  "party-orgs": "partyOrg.manage",
};
