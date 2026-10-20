// Đặc tả cột cho nhập Excel (Mục 11 — Import) — dùng chung cho file mẫu, đọc file và báo lỗi theo dòng.
import { z } from "zod";

import {
  PARTY_BLOCK_LABELS,
  PARTY_ORG_TYPE_LABELS,
  SCHOOL_LEVEL_LABELS,
  SCHOOL_OWNERSHIP_LABELS,
} from "@/lib/i18n/enums";
import {
  partyBlockEnum,
  partyOrgTypeEnum,
  schoolLevelEnum,
  schoolOwnershipEnum,
  schoolYearField,
} from "@/lib/schemas/catalog";
import {
  optionalEmail,
  optionalInt,
  optionalPhone,
  optionalText,
  requiredInt,
  requiredText,
} from "@/lib/schemas/common";

export type ImportKind = "schools" | "residentials" | "party-orgs";

export type ImportColumn = {
  key: string;
  header: string;
  required?: boolean;
  /** Nhãn tiếng Việt → giá trị enum (ô chọn trong file mẫu) */
  choices?: Record<string, string>;
  /** Ô dạng văn bản (giữ số 0 đầu ở số điện thoại) */
  text?: boolean;
  width?: number;
  note?: string;
};

export type ImportSpec = {
  kind: ImportKind;
  title: string;
  sheetName: string;
  columns: ImportColumn[];
  rowSchema: z.ZodType<Record<string, unknown>>;
  /** Dòng ví dụ trong file mẫu */
  example: Record<string, string | number>;
};

/** Đảo Record<enum, nhãn> thành nhãn → enum */
function choicesOf(labels: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(labels).map(([value, label]) => [label, value]));
}

export const MAX_IMPORT_ROWS = 2000;

const schoolRow = z
  .object({
    name: requiredText("tên trường", 200),
    level: schoolLevelEnum,
    ownership: schoolOwnershipEnum,
    address: optionalText("địa chỉ", 300),
    phone: optionalPhone(),
    email: optionalEmail(),
    principal: optionalText("tên hiệu trưởng", 100),
    principalPhone: optionalPhone("số điện thoại hiệu trưởng"),
    schoolYear: z.preprocess(
      (v) => (v === "" || v == null ? null : String(v)),
      schoolYearField.nullable(),
    ),
    staffTotal: optionalInt("tổng CB-GV-NV"),
    classes: optionalInt("số lớp"),
    students: optionalInt("số học sinh"),
    femaleStudents: optionalInt("số học sinh nữ"),
  })
  .superRefine((v, ctx) => {
    const hasStats = [v.staffTotal, v.classes, v.students, v.femaleStudents].some(
      (x) => x !== null,
    );
    if (!hasStats) return;
    if (!v.schoolYear)
      ctx.addIssue({
        code: "custom",
        path: ["schoolYear"],
        message: "Có số liệu thì phải ghi năm học (VD 2026-2027).",
      });
    if (v.staffTotal === null)
      ctx.addIssue({
        code: "custom",
        path: ["staffTotal"],
        message: "Có số liệu năm học thì phải ghi tổng CB-GV-NV.",
      });
    if (v.students === null)
      ctx.addIssue({
        code: "custom",
        path: ["students"],
        message: "Có số liệu năm học thì phải ghi số học sinh.",
      });
    if (v.students !== null && v.femaleStudents !== null && v.femaleStudents > v.students) {
      ctx.addIssue({
        code: "custom",
        path: ["femaleStudents"],
        message: "Số học sinh nữ không được lớn hơn tổng số học sinh.",
      });
    }
  });

const residentialRow = z.object({
  name: requiredText("tên tổ dân phố", 150),
  code: optionalInt("số thứ tự", { max: 100_000 }),
  oldAreaName: optionalText("khu vực cũ", 100),
  leaderName: optionalText("tên tổ trưởng", 100),
  leaderPhone: optionalPhone("số điện thoại tổ trưởng"),
  households: optionalInt("số hộ"),
  population: optionalInt("số nhân khẩu"),
  partyOrgName: optionalText("chi bộ phụ trách", 200),
  note: optionalText("ghi chú", 500),
});

const partyOrgRow = z
  .object({
    name: requiredText("tên tổ chức", 200),
    type: partyOrgTypeEnum,
    block: partyBlockEnum,
    parentName: optionalText("cấp trên trực tiếp", 200),
    secretary: optionalText("tên bí thư", 100),
    secretaryPhone: optionalPhone("số điện thoại bí thư"),
    deputySecretary: optionalText("tên phó bí thư", 100),
    memberCount: requiredInt("số đảng viên"),
    officialMembers: optionalInt("số đảng viên chính thức"),
    probationaryMembers: optionalInt("số đảng viên dự bị"),
    latestRating: optionalText("xếp loại", 100),
    ratingYear: optionalInt("năm xếp loại", { min: 2000, max: 2100 }),
    residentialName: optionalText("tổ dân phố liên kết", 150),
    schoolName: optionalText("trường liên kết", 200),
  })
  .refine(
    (v) =>
      v.officialMembers === null ||
      v.probationaryMembers === null ||
      v.officialMembers + v.probationaryMembers === v.memberCount,
    { path: ["memberCount"], message: "Tổng số đảng viên phải bằng chính thức + dự bị." },
  );

export const IMPORT_SPECS: Record<ImportKind, ImportSpec> = {
  schools: {
    kind: "schools",
    title: "Trường học",
    sheetName: "Truong hoc",
    rowSchema: schoolRow as unknown as z.ZodType<Record<string, unknown>>,
    columns: [
      { key: "name", header: "Tên trường", required: true, width: 36 },
      {
        key: "level",
        header: "Cấp học",
        required: true,
        choices: choicesOf(SCHOOL_LEVEL_LABELS),
        width: 14,
      },
      {
        key: "ownership",
        header: "Loại hình",
        required: true,
        choices: choicesOf(SCHOOL_OWNERSHIP_LABELS),
        width: 14,
      },
      { key: "address", header: "Địa chỉ", width: 30 },
      { key: "phone", header: "Điện thoại", text: true, width: 14 },
      { key: "email", header: "Email", width: 24 },
      { key: "principal", header: "Hiệu trưởng", width: 22 },
      { key: "principalPhone", header: "SĐT hiệu trưởng", text: true, width: 16 },
      {
        key: "schoolYear",
        header: "Năm học",
        text: true,
        width: 12,
        note: "VD 2026-2027; để trống nếu không nhập số liệu",
      },
      { key: "staffTotal", header: "Tổng CB-GV-NV", width: 14 },
      { key: "classes", header: "Số lớp", width: 10 },
      { key: "students", header: "Số học sinh", width: 12 },
      { key: "femaleStudents", header: "Học sinh nữ", width: 12 },
    ],
    example: {
      name: "Trường THCS Thanh Liệt",
      level: "THCS",
      ownership: "Công lập",
      address: "Thanh Liệt, Hà Nội",
      phone: "02438612345",
      principal: "Nguyễn Văn A",
      schoolYear: "2026-2027",
      staffTotal: 65,
      classes: 28,
      students: 1150,
    },
  },
  residentials: {
    kind: "residentials",
    title: "Tổ dân phố",
    sheetName: "To dan pho",
    rowSchema: residentialRow as unknown as z.ZodType<Record<string, unknown>>,
    columns: [
      { key: "name", header: "Tên TDP", required: true, width: 26 },
      { key: "code", header: "Số thứ tự", width: 10 },
      {
        key: "oldAreaName",
        header: "Khu vực cũ",
        width: 18,
        note: "Đúng tên trong danh mục Khu vực cũ",
      },
      { key: "leaderName", header: "Tổ trưởng", width: 22 },
      { key: "leaderPhone", header: "SĐT tổ trưởng", text: true, width: 15 },
      { key: "households", header: "Số hộ", width: 10 },
      { key: "population", header: "Số nhân khẩu", width: 13 },
      {
        key: "partyOrgName",
        header: "Chi bộ phụ trách",
        width: 30,
        note: "Đúng tên trong danh mục Tổ chức đảng",
      },
      { key: "note", header: "Ghi chú", width: 30 },
    ],
    example: {
      name: "Tổ dân phố số 1",
      code: 1,
      oldAreaName: "Thanh Liệt",
      leaderName: "Trần Văn B",
      leaderPhone: "0912345678",
      households: 420,
      population: 1450,
    },
  },
  "party-orgs": {
    kind: "party-orgs",
    title: "Tổ chức đảng",
    sheetName: "To chuc dang",
    rowSchema: partyOrgRow as unknown as z.ZodType<Record<string, unknown>>,
    columns: [
      { key: "name", header: "Tên tổ chức", required: true, width: 34 },
      {
        key: "type",
        header: "Loại",
        required: true,
        choices: choicesOf(PARTY_ORG_TYPE_LABELS),
        width: 18,
      },
      {
        key: "block",
        header: "Khối",
        required: true,
        choices: choicesOf(PARTY_BLOCK_LABELS),
        width: 18,
      },
      {
        key: "parentName",
        header: "Cấp trên trực tiếp",
        width: 30,
        note: "Để trống = trực thuộc Đảng bộ phường",
      },
      { key: "secretary", header: "Bí thư", width: 22 },
      { key: "secretaryPhone", header: "SĐT bí thư", text: true, width: 14 },
      { key: "deputySecretary", header: "Phó Bí thư", width: 22 },
      { key: "memberCount", header: "Số đảng viên", required: true, width: 12 },
      { key: "officialMembers", header: "Chính thức", width: 11 },
      { key: "probationaryMembers", header: "Dự bị", width: 9 },
      { key: "latestRating", header: "Xếp loại năm gần nhất", width: 26 },
      { key: "ratingYear", header: "Năm xếp loại", width: 12 },
      { key: "residentialName", header: "TDP liên kết", width: 22 },
      { key: "schoolName", header: "Trường liên kết", width: 26 },
    ],
    example: {
      name: "Chi bộ Tổ dân phố số 1",
      type: "Chi bộ cơ sở",
      block: "Khu dân cư (TDP)",
      secretary: "Lê Thị C",
      memberCount: 42,
      officialMembers: 40,
      probationaryMembers: 2,
      residentialName: "Tổ dân phố số 1",
    },
  },
};

export function isImportKind(value: string): value is ImportKind {
  return value in IMPORT_SPECS;
}
