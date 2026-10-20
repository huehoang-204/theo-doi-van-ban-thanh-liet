import type { Option } from "@/components/common/EntityForm";
import type { TreeNodeDTO } from "@/server/documents/queries";

export type { TreeNodeDTO };

/** Thông tin tối thiểu về một nút để mở hộp thoại thêm con / chuyển / xoá */
export type NodeRef = {
  id: string;
  parentId: string | null;
  path: string;
  depth: number;
  label: string;
  isProgram: boolean;
};

export type DocumentFormOptions = {
  types: { id: string; code: string; name: string; isProgram: boolean }[];
  fields: Option[];
  agencies: Option[];
  departments: Option[];
};

export type TreePermissions = {
  canCreate: boolean;
  canCreateProgram: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

export const nodeLabel = (n: { number: string | null; title: string }) =>
  n.number ? `${n.number} – ${n.title}` : n.title;

export function refOf(n: TreeNodeDTO): NodeRef {
  return {
    id: n.id,
    parentId: n.parentId,
    path: n.path,
    depth: n.depth,
    label: nodeLabel(n),
    isProgram: n.type.isProgram,
  };
}
