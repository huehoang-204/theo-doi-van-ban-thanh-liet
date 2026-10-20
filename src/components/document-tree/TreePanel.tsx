"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  GripVertical,
  Loader2,
  Lock,
  Plus,
  Search,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { formatNumber } from "@/lib/format";
import { VALIDITY_LABELS } from "@/lib/schemas/document";
import {
  canAddChild,
  dropIntent,
  isInSubtree,
  resolveDrop,
  sortSiblings,
  type DropIntent,
} from "@/lib/tree";
import { cn } from "@/lib/utils";
import { moveDocument } from "@/server/actions/documents";

import { useTree } from "./TreeContext";
import { TypeIcon } from "./type-icon";
import { nodeLabel, refOf, type TreeNodeDTO } from "./types";

const ROOT = "";

/** Id văn bản đang mở theo đường dẫn /van-ban/<id> */
export function useSelectedId(): string | null {
  const pathname = usePathname();
  const m = /^\/van-ban\/([^/]+)$/.exec(pathname);
  return m && m[1] !== "danh-sach" ? decodeURIComponent(m[1]!) : null;
}

type DropState = { activeId: string; overId: string | null; intent: DropIntent | null };

export function TreePanel() {
  const tree = useTree();
  const router = useRouter();
  const selectedId = useSelectedId();
  const [drag, setDrag] = useState<DropState | null>(null);
  const pointerStart = useRef(0);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // Mở sẵn đường tới văn bản đang xem (VD mở thẳng liên kết /van-ban/<id>)
  const { nodes, reveal } = tree;
  useEffect(() => {
    if (selectedId && !nodes[selectedId]) void reveal([selectedId]);
  }, [selectedId, nodes, reveal]);

  const sorted = (parentKey: string) =>
    sortSiblings(
      (tree.children[parentKey] ?? [])
        .map((id) => tree.nodes[id])
        .filter((n): n is TreeNodeDTO => !!n),
      tree.sortMode,
    );

  function onDragStart(e: DragStartEvent) {
    pointerStart.current = (e.activatorEvent as PointerEvent).clientY;
    setDrag({ activeId: String(e.active.id), overId: null, intent: null });
  }

  function onDragMove(e: DragMoveEvent) {
    const overId = e.over ? String(e.over.id) : null;
    if (!overId || overId === String(e.active.id))
      return setDrag((d) => d && { ...d, overId: null, intent: null });
    const row = document.querySelector<HTMLElement>(`[data-node-row="${CSS.escape(overId)}"]`);
    const over = tree.nodes[overId];
    if (!row || !over) return;
    const rect = row.getBoundingClientRect();
    const intent = dropIntent(
      rect.top,
      rect.height,
      pointerStart.current + e.delta.y,
      canAddChild(over.depth, tree.maxDepth),
    );
    setDrag((d) => d && { ...d, overId, intent });
  }

  async function onDragEnd(_e: DragEndEvent) {
    const state = drag;
    setDrag(null);
    if (!state?.overId || !state.intent) return;
    const moved = tree.nodes[state.activeId];
    const target = tree.nodes[state.overId];
    if (!moved || !target) return;

    const { newParentId, index } = resolveDrop({
      intent: state.intent,
      target: { id: target.id, parentId: target.parentId },
      targetSiblingIds: sorted(target.parentId ?? ROOT).map((n) => n.id),
      targetChildIds:
        tree.children[target.id] ?? Array.from({ length: target.childCount }, (_, i) => `?${i}`),
      movedId: moved.id,
    });
    const newParent = newParentId ? tree.nodes[newParentId] : null;
    if (newParent && isInSubtree(moved, newParent)) {
      toast.error(
        newParent.id === moved.id
          ? "Không thể chuyển văn bản vào chính nó."
          : `Không thể chuyển “${nodeLabel(moved)}” vào “${nodeLabel(newParent)}” vì đó là văn bản con/cháu của chính nó.`,
      );
      return;
    }
    if (tree.sortMode !== "manual" && newParentId === moved.parentId) {
      toast.info(
        "Đang sắp theo ngày ban hành — chuyển sang “Thứ tự thủ công” để sắp xếp bằng kéo-thả.",
      );
      return;
    }
    const result = await moveDocument({ id: moved.id, newParentId, index });
    if (!result.ok) {
      toast.error(result.error.message, { duration: 10_000 });
      return;
    }
    toast.success(
      newParentId === moved.parentId ? "Đã sắp xếp lại." : `Đã chuyển “${nodeLabel(moved)}”.`,
    );
    await tree.refresh([result.data.oldParentId, result.data.newParentId]);
    if (newParentId && !tree.expanded.has(newParentId)) tree.toggle(newParentId);
    router.refresh();
  }

  const roots = sorted(ROOT);
  const active = drag ? tree.nodes[drag.activeId] : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TreeToolbar />
      <DndContext
        id="cay-van-ban"
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={onDragStart}
        onDragMove={onDragMove}
        onDragEnd={onDragEnd}
        onDragCancel={() => setDrag(null)}
      >
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {roots.length === 0 ? (
            <p className="p-4 text-muted-foreground">Chưa có chương trình nào.</p>
          ) : (
            <ul role="tree" aria-label="Cây văn bản" className="flex flex-col">
              {roots.map((n) => (
                <TreeRow key={n.id} node={n} selectedId={selectedId} drag={drag} sorted={sorted} />
              ))}
            </ul>
          )}
        </div>
        <DragOverlay dropAnimation={null}>
          {active && (
            <div className="flex max-w-sm items-center gap-2 rounded-lg border bg-card px-3 py-2 shadow-lg">
              <TypeIcon icon={active.type.icon} color={active.type.color} className="size-5" />
              <span className="truncate font-medium">{nodeLabel(active)}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

// ---------------------------------------------------------------- Thanh công cụ: tìm, lọc, mở/thu, sắp xếp

function TreeToolbar() {
  const tree = useTree();
  const [query, setQuery] = useState("");
  const [fieldId, setFieldId] = useState("");
  const [validity, setValidity] = useState("");
  const [result, setResult] = useState<{ count: number; truncated: boolean } | null>(null);
  const [searching, setSearching] = useState(false);
  const { applyReveal, setMatches } = tree;

  const active = query.trim().length >= 2 || !!fieldId || !!validity;

  /** Đổi điều kiện tìm; hết điều kiện thì bỏ tô vàng ngay */
  function update(next: { query?: string; fieldId?: string; validity?: string }) {
    const q = next.query ?? query;
    const f = next.fieldId ?? fieldId;
    const v = next.validity ?? validity;
    if (next.query !== undefined) setQuery(q);
    if (next.fieldId !== undefined) setFieldId(f);
    if (next.validity !== undefined) setValidity(v);
    if (q.trim().length < 2 && !f && !v) {
      setMatches(null);
      setResult(null);
    }
  }

  useEffect(() => {
    if (!active) return;
    const q = query.trim();
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams({ mo: "1", gioiHan: "100" });
        if (q.length >= 2) params.set("q", q);
        if (fieldId) params.set("linhVuc", fieldId);
        if (validity) params.set("hieuLuc", validity);
        const res = await fetch(`/api/documents/search?${params}`, { signal: controller.signal });
        const data = (await res.json()) as {
          hits: { id: string }[];
          truncated: boolean;
          reveal: { nodes: TreeNodeDTO[]; expand: string[] } | null;
        };
        if (data.reveal) applyReveal(data.reveal);
        setMatches(data.hits.map((h) => h.id));
        setResult({ count: data.hits.length, truncated: data.truncated });
      } catch {
        /* huỷ do gõ tiếp */
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [active, query, fieldId, validity, applyReveal, setMatches]);

  const clear = () => update({ query: "", fieldId: "", validity: "" });

  return (
    <div className="flex flex-col gap-2 border-b p-3">
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={query}
          onChange={(e) => update({ query: e.target.value })}
          placeholder="Tìm văn bản (gõ không dấu được)…"
          aria-label="Tìm văn bản"
          className="pl-10"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <NativeSelect
          size="sm"
          value={fieldId}
          onChange={(e) => update({ fieldId: e.target.value })}
          aria-label="Lọc theo lĩnh vực"
          className="min-w-0 flex-1"
        >
          <NativeSelectOption value="">Mọi lĩnh vực</NativeSelectOption>
          {tree.options.fields.map((f) => (
            <NativeSelectOption key={f.value} value={f.value}>
              {f.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect
          size="sm"
          value={validity}
          onChange={(e) => update({ validity: e.target.value })}
          aria-label="Lọc theo trạng thái văn bản"
          className="min-w-0 flex-1"
        >
          <NativeSelectOption value="">Mọi trạng thái</NativeSelectOption>
          {Object.entries(VALIDITY_LABELS).map(([v, l]) => (
            <NativeSelectOption key={v} value={v}>
              {l}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      {active && result && (
        <div
          role="status"
          className="flex items-center justify-between gap-2 rounded-lg bg-status-due-soon/15 px-3 py-1.5 text-[0.9375rem]"
        >
          <span>
            {searching
              ? "Đang tìm…"
              : result.count === 0
                ? "Không tìm thấy văn bản phù hợp."
                : `Tìm thấy ${formatNumber(result.count)}${result.truncated ? "+" : ""} văn bản (tô vàng).`}
          </span>
          <Button variant="ghost" size="sm" onClick={clear}>
            <X aria-hidden />
            Xoá tìm
          </Button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1">
        <Button variant="ghost" size="sm" onClick={() => void tree.expandAll()}>
          <ChevronsUpDown aria-hidden />
          Mở tất cả
        </Button>
        <Button variant="ghost" size="sm" onClick={tree.collapseAll}>
          <ChevronsDownUp aria-hidden />
          Thu tất cả
        </Button>
        <NativeSelect
          size="sm"
          value={tree.sortMode}
          onChange={(e) => tree.setSortMode(e.target.value as "manual" | "issuedDate")}
          aria-label="Sắp xếp văn bản"
          className="ml-auto"
        >
          <NativeSelectOption value="manual">Thứ tự thủ công</NativeSelectOption>
          <NativeSelectOption value="issuedDate">Ngày ban hành</NativeSelectOption>
        </NativeSelect>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Một dòng cây

type RowProps = {
  node: TreeNodeDTO;
  selectedId: string | null;
  drag: DropState | null;
  sorted: (parentKey: string) => TreeNodeDTO[];
};

function TreeRow({ node, selectedId, drag, sorted }: RowProps) {
  const tree = useTree();
  const router = useRouter();
  const isOpen = tree.expanded.has(node.id);
  const isLoading = tree.loading.has(node.id);
  const isSelected = selectedId === node.id;
  const isMatch = tree.matches?.has(node.id) ?? false;
  const canDrag = tree.permissions.canEdit && !node.restricted;
  const canAdd =
    tree.permissions.canCreate && !node.restricted && canAddChild(node.depth, tree.maxDepth);

  const {
    setNodeRef: setDragRef,
    setActivatorNodeRef,
    listeners,
    attributes,
    isDragging,
  } = useDraggable({ id: node.id, disabled: !canDrag });
  const droppable = useDroppable({ id: node.id, disabled: !tree.permissions.canEdit });
  const dropHere =
    drag && drag.overId === node.id && drag.activeId !== node.id ? drag.intent : null;
  const kids = useMemo(() => (isOpen ? sorted(node.id) : []), [isOpen, sorted, node.id]);

  const ref = refOf(node);
  return (
    <li
      role="treeitem"
      aria-level={node.depth}
      aria-expanded={node.childCount > 0 ? isOpen : undefined}
      aria-selected={isSelected}
    >
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            ref={(el) => {
              droppable.setNodeRef(el);
              setDragRef(el);
            }}
            data-node-row={node.id}
            data-depth={node.depth}
            className={cn(
              "group relative flex min-h-11 items-center gap-1 rounded-lg pr-1 transition-colors",
              isSelected ? "bg-brand-soft" : "hover:bg-slate-100",
              isMatch && !isSelected && "bg-amber-100 hover:bg-amber-200",
              isDragging && "opacity-40",
              dropHere === "inside" && "ring-2 ring-brand ring-inset",
              dropHere === "before" &&
                "before:absolute before:inset-x-0 before:-top-0.5 before:h-1 before:rounded before:bg-brand",
              dropHere === "after" &&
                "after:absolute after:inset-x-0 after:-bottom-0.5 after:h-1 after:rounded after:bg-brand",
            )}
            style={{ paddingLeft: `${(node.depth - 1) * 1.25}rem` }}
          >
            {node.childCount > 0 ? (
              <button
                type="button"
                onClick={() => tree.toggle(node.id)}
                className="flex size-8 shrink-0 items-center justify-center rounded-md hover:bg-slate-200"
                aria-label={isOpen ? `Thu nhánh ${nodeLabel(node)}` : `Mở nhánh ${nodeLabel(node)}`}
              >
                {isLoading ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : isOpen ? (
                  <ChevronDown className="size-5" aria-hidden />
                ) : (
                  <ChevronRight className="size-5" aria-hidden />
                )}
              </button>
            ) : (
              <span className="size-8 shrink-0" aria-hidden />
            )}
            {canDrag && (
              <button
                type="button"
                ref={setActivatorNodeRef}
                {...listeners}
                {...attributes}
                className="-ml-1 hidden size-6 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground group-hover:flex hover:bg-slate-200 active:cursor-grabbing"
                aria-label={`Kéo để di chuyển ${nodeLabel(node)}`}
                title="Kéo để di chuyển / sắp xếp"
              >
                <GripVertical className="size-4" aria-hidden />
              </button>
            )}
            <Link
              href={`/van-ban/${node.id}`}
              className={cn(
                "flex min-w-0 flex-1 items-center gap-2 py-1.5 focus-visible:outline-2 focus-visible:outline-ring",
                node.restricted && "text-muted-foreground",
              )}
              aria-current={isSelected ? "page" : undefined}
            >
              <TypeIcon icon={node.type.icon} color={node.type.color} className="size-5 shrink-0" />
              <span className="min-w-0 flex-1 truncate">
                {node.number && <strong className="font-semibold">{node.number} </strong>}
                <span className={cn(node.depth === 1 && !node.number && "font-semibold")}>
                  {node.title}
                </span>
              </span>
              {node.restricted && (
                <Lock className="size-4 shrink-0" aria-label="Không có quyền xem chi tiết" />
              )}
              {node.validity !== "ACTIVE" && (
                <span className="shrink-0 text-sm text-muted-foreground">
                  ({VALIDITY_LABELS[node.validity]})
                </span>
              )}
              {node.progress > 0 && (
                <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                  {node.progress}%
                </span>
              )}
              {node.hasOverdue && (
                <span
                  className="size-2.5 shrink-0 rounded-full bg-status-overdue"
                  title="Nhánh có việc quá hạn"
                  aria-label="Nhánh có việc quá hạn"
                />
              )}
              {node.childCount > 0 && (
                <span
                  className="shrink-0 rounded-full bg-slate-200 px-2 text-sm text-slate-700 tabular-nums"
                  aria-label={`${node.childCount} văn bản con`}
                >
                  {node.childCount}
                </span>
              )}
            </Link>
            {canAdd && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                onClick={() => tree.openCreate(ref)}
                aria-label={`Thêm văn bản con vào ${nodeLabel(node)}`}
                title="Thêm văn bản con"
                data-testid="add-child"
              >
                <Plus aria-hidden />
              </Button>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-60">
          <ContextMenuItem onSelect={() => router.push(`/van-ban/${node.id}`)}>
            Mở chi tiết
          </ContextMenuItem>
          {canAdd && (
            <ContextMenuItem onSelect={() => tree.openCreate(ref)}>
              Thêm văn bản con
            </ContextMenuItem>
          )}
          {tree.permissions.canEdit && !node.restricted && (
            <>
              <ContextMenuItem onSelect={() => router.push(`/van-ban/${node.id}?sua=1`)}>
                Sửa
              </ContextMenuItem>
              <ContextMenuItem onSelect={() => tree.openMove(ref)}>Chuyển đến…</ContextMenuItem>
            </>
          )}
          {tree.permissions.canDelete && !node.restricted && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem variant="destructive" onSelect={() => tree.openDelete(ref)}>
                Xoá…
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
      {isOpen && kids.length > 0 && (
        <ul role="group" className="flex flex-col">
          {kids.map((k) => (
            <TreeRow key={k.id} node={k} selectedId={selectedId} drag={drag} sorted={sorted} />
          ))}
        </ul>
      )}
      {isOpen && isLoading && kids.length === 0 && (
        <p
          className="py-1 text-muted-foreground"
          style={{ paddingLeft: `${node.depth * 1.25 + 2}rem` }}
        >
          Đang tải…
        </p>
      )}
    </li>
  );
}
