"use client";

import { FolderTree, Plus } from "lucide-react";

import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";

import { useTree } from "./TreeContext";

export function DocumentsEmptyState() {
  const tree = useTree();
  const empty = (tree.children[""] ?? []).length === 0;
  if (empty) {
    return (
      <EmptyState
        icon={FolderTree}
        title="Chưa có chương trình nào."
        description="Mỗi cây văn bản bắt đầu từ một Chương trình (cấp 1), sau đó thêm Kế hoạch, Quyết định… bên dưới."
        action={
          tree.permissions.canCreateProgram && (
            <Button size="lg" onClick={() => tree.openCreate(null)}>
              <Plus aria-hidden />
              Tạo chương trình đầu tiên
            </Button>
          )
        }
      />
    );
  }
  return (
    <EmptyState
      icon={FolderTree}
      title="Chọn một văn bản ở cây bên trái để xem chi tiết"
      description="Bấm mũi tên để mở nhánh; rê chuột vào dòng để thấy nút “+” thêm văn bản con; bấm chuột phải để có thêm thao tác; kéo biểu tượng ⋮⋮ để di chuyển."
      className="border-0"
    />
  );
}
