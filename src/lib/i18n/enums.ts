// Nhãn tiếng Việt cho các enum trong CSDL — dùng cho hiển thị, ô chọn và nhập/xuất Excel.
import type {
  PartyBlock,
  PartyOrgType,
  SchoolLevel,
  SchoolOwnership,
} from "@/generated/prisma/enums";

export const SCHOOL_LEVEL_LABELS: Record<SchoolLevel, string> = {
  MAM_NON: "Mầm non",
  TIEU_HOC: "Tiểu học",
  THCS: "THCS",
  THPT: "THPT",
  LIEN_CAP: "Liên cấp",
  GDNN_GDTX: "GDNN-GDTX",
};

export const SCHOOL_OWNERSHIP_LABELS: Record<SchoolOwnership, string> = {
  CONG_LAP: "Công lập",
  TU_THUC: "Tư thục",
  DAN_LAP: "Dân lập",
};

export const PARTY_ORG_TYPE_LABELS: Record<PartyOrgType, string> = {
  DANG_BO_PHUONG: "Đảng bộ phường",
  DANG_BO_BO_PHAN: "Đảng bộ bộ phận",
  DANG_BO_CO_SO: "Đảng bộ cơ sở",
  CHI_BO_CO_SO: "Chi bộ cơ sở",
  CHI_BO_TRUC_THUOC: "Chi bộ trực thuộc",
};

export const PARTY_BLOCK_LABELS: Record<PartyBlock, string> = {
  KHU_DAN_CU: "Khu dân cư (TDP)",
  CO_QUAN: "Cơ quan hành chính",
  TRUONG_HOC: "Trường học",
  Y_TE: "Y tế",
  DOANH_NGHIEP: "Doanh nghiệp",
  CONG_AN: "Công an",
  QUAN_SU: "Quân sự",
  KHAC: "Khác",
};

export const PARTY_RATING_OPTIONS = [
  "Hoàn thành xuất sắc nhiệm vụ",
  "Hoàn thành tốt nhiệm vụ",
  "Hoàn thành nhiệm vụ",
  "Không hoàn thành nhiệm vụ",
] as const;

export const AGENCY_LEVEL_OPTIONS = ["Phường", "Thành phố", "Trung ương", "Khác"] as const;

/** Đổi Record nhãn thành danh sách lựa chọn cho ô chọn */
export function optionsOf<K extends string>(
  labels: Record<K, string>,
): { value: K; label: string }[] {
  return (Object.entries(labels) as [K, string][]).map(([value, label]) => ({ value, label }));
}
