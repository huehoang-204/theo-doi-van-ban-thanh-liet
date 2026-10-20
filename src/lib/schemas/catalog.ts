// Schema danh mục — dùng chung cho form, server action và nhập Excel.
import { z } from "zod";

import {
  boolField,
  idField,
  optionalDate,
  optionalDecimal,
  optionalEmail,
  optionalId,
  optionalInt,
  optionalPhone,
  optionalText,
  requiredInt,
  requiredText,
} from "@/lib/schemas/common";

const sortOrder = optionalInt("thứ tự", { max: 100_000 }).transform((v) => v ?? 0);

// ---------- Đơn vị ----------
export const departmentSchema = z.object({
  id: idField,
  name: requiredText("tên đơn vị", 150),
  shortName: optionalText("tên viết tắt", 50),
  sortOrder,
  active: boolField,
});

// ---------- Danh mục chung ----------
export const documentTypeSchema = z.object({
  id: idField,
  code: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập mã loại văn bản.")
    .max(10, "Mã loại văn bản tối đa 10 ký tự.")
    .regex(/^[A-Za-z0-9]+$/, "Mã loại văn bản chỉ gồm chữ không dấu và số (VD: KH, QD, CV)."),
  name: requiredText("tên loại văn bản", 100),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Màu nhãn phải có dạng #RRGGBB."),
  icon: requiredText("biểu tượng", 50),
  isProgram: boolField,
  sortOrder,
  active: boolField,
});

export const fieldSchema = z.object({
  id: idField,
  name: requiredText("tên lĩnh vực", 100),
  sortOrder,
  active: boolField,
});

export const issuingAgencySchema = z.object({
  id: idField,
  name: requiredText("tên cơ quan", 200),
  level: optionalText("cấp", 50),
  active: boolField,
});

export const oldAreaSchema = z.object({
  id: idField,
  name: requiredText("tên khu vực", 100),
  sortOrder,
});

// ---------- Thông tin phường ----------
export const wardProfileSchema = z.object({
  name: requiredText("tên đơn vị", 150),
  city: requiredText("thành phố", 100),
  areaKm2: optionalDecimal("diện tích", { min: 0.01, max: 100000 }).refine(
    (v) => v !== null,
    "Vui lòng nhập diện tích.",
  ),
  population: requiredInt("dân số", { min: 1 }),
  populationIsEstimate: boolField,
  households: optionalInt("số hộ"),
  establishedDate: optionalDate("ngày thành lập"),
  address: optionalText("địa chỉ trụ sở", 300),
  phone: optionalPhone("điện thoại trụ sở"),
});

export const partyOverrideSchema = z.object({
  partyOrgCountOverride: optionalInt("số tổ chức đảng"),
  partyCellCountOverride: optionalInt("số chi bộ"),
  partyMemberCountOverride: optionalInt("số đảng viên"),
});

// ---------- Trường học ----------
export const schoolLevelEnum = z.enum(
  ["MAM_NON", "TIEU_HOC", "THCS", "THPT", "LIEN_CAP", "GDNN_GDTX"],
  {
    error: "Vui lòng chọn cấp học.",
  },
);
export const schoolOwnershipEnum = z.enum(["CONG_LAP", "TU_THUC", "DAN_LAP"], {
  error: "Vui lòng chọn loại hình.",
});

export const schoolSchema = z.object({
  id: idField,
  name: requiredText("tên trường", 200),
  level: schoolLevelEnum,
  ownership: schoolOwnershipEnum,
  address: optionalText("địa chỉ", 300),
  phone: optionalPhone(),
  email: optionalEmail(),
  principal: optionalText("tên hiệu trưởng", 100),
  principalPhone: optionalPhone("số điện thoại hiệu trưởng"),
  lat: optionalDecimal("vĩ độ", { min: -90, max: 90 }),
  lng: optionalDecimal("kinh độ", { min: -180, max: 180 }),
  sortOrder,
  active: boolField,
});

export const schoolYearRegex = /^(\d{4})-(\d{4})$/;

export const schoolYearField = z
  .string()
  .trim()
  .refine((v) => {
    const m = schoolYearRegex.exec(v);
    return !!m && Number(m[2]) === Number(m[1]) + 1;
  }, "Năm học phải có dạng 2026-2027 (năm sau hơn năm trước 1).");

export const schoolYearStatSchema = z
  .object({
    id: idField,
    schoolId: z.string().min(1, "Thiếu trường học."),
    schoolYear: schoolYearField,
    staffTotal: requiredInt("tổng CB-GV-NV"),
    managers: optionalInt("số cán bộ quản lý"),
    teachers: optionalInt("số giáo viên"),
    employees: optionalInt("số nhân viên"),
    classes: optionalInt("số lớp"),
    students: requiredInt("số học sinh"),
    femaleStudents: optionalInt("số học sinh nữ"),
    note: optionalText("ghi chú", 500),
  })
  .refine((v) => v.femaleStudents === null || v.femaleStudents <= v.students, {
    path: ["femaleStudents"],
    message: "Số học sinh nữ không được lớn hơn tổng số học sinh.",
  })
  .refine((v) => (v.managers ?? 0) + (v.teachers ?? 0) + (v.employees ?? 0) <= v.staffTotal, {
    path: ["staffTotal"],
    message: "Tổng CB-GV-NV phải lớn hơn hoặc bằng tổng cán bộ quản lý + giáo viên + nhân viên.",
  });

// ---------- Tổ dân phố ----------
export const residentialSchema = z.object({
  id: idField,
  name: requiredText("tên tổ dân phố", 150),
  code: optionalInt("số thứ tự", { max: 100_000 }),
  oldAreaId: optionalId,
  leaderName: optionalText("tên tổ trưởng", 100),
  leaderPhone: optionalPhone("số điện thoại tổ trưởng"),
  households: optionalInt("số hộ"),
  population: optionalInt("số nhân khẩu"),
  partyOrgId: optionalId,
  note: optionalText("ghi chú", 500),
  active: boolField,
});

// ---------- Tổ chức đảng ----------
export const partyOrgTypeEnum = z.enum(
  ["DANG_BO_PHUONG", "DANG_BO_BO_PHAN", "DANG_BO_CO_SO", "CHI_BO_CO_SO", "CHI_BO_TRUC_THUOC"],
  { error: "Vui lòng chọn loại tổ chức." },
);
export const partyBlockEnum = z.enum(
  ["KHU_DAN_CU", "CO_QUAN", "TRUONG_HOC", "Y_TE", "DOANH_NGHIEP", "CONG_AN", "QUAN_SU", "KHAC"],
  { error: "Vui lòng chọn khối." },
);

export const partyOrgSchema = z
  .object({
    id: idField,
    name: requiredText("tên tổ chức", 200),
    type: partyOrgTypeEnum,
    block: partyBlockEnum,
    parentId: optionalId,
    secretary: optionalText("tên bí thư", 100),
    secretaryPhone: optionalPhone("số điện thoại bí thư"),
    deputySecretary: optionalText("tên phó bí thư", 100),
    memberCount: requiredInt("số đảng viên"),
    officialMembers: optionalInt("số đảng viên chính thức"),
    probationaryMembers: optionalInt("số đảng viên dự bị"),
    latestRating: optionalText("xếp loại", 100),
    ratingYear: optionalInt("năm xếp loại", { min: 2000, max: 2100 }),
    residentialId: optionalId,
    schoolId: optionalId,
    sortOrder,
    active: boolField,
  })
  .refine(
    (v) =>
      v.officialMembers === null ||
      v.probationaryMembers === null ||
      v.officialMembers + v.probationaryMembers === v.memberCount,
    { path: ["memberCount"], message: "Tổng số đảng viên phải bằng chính thức + dự bị." },
  );
