"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import type { SortMode } from "@/lib/tree";

import type { DocumentFormOptions, NodeRef, TreeNodeDTO, TreePermissions } from "./types";

const ROOT = "";
const keyOf = (parentId: string | null) => parentId ?? ROOT;

type DialogState =
  | { kind: "create"; parent: NodeRef | null }
  | { kind: "move"; node: NodeRef }
  | { kind: "delete"; node: NodeRef }
  | null;

type TreeContextValue = {
  maxDepth: number;
  options: DocumentFormOptions;
  permissions: TreePermissions;
  nodes: Record<string, TreeNodeDTO>;
  /** Con đã tải theo cha ("" = cấp 1) */
  children: Record<string, string[]>;
  expanded: Set<string>;
  loading: Set<string>;
  /** Kết quả tìm kiếm đang làm nổi bật (null = không tìm) */
  matches: Set<string> | null;
  sortMode: SortMode;
  setSortMode: (mode: SortMode) => void;
  toggle: (id: string) => void;
  expandAll: () => Promise<void>;
  collapseAll: () => void;
  /** Mở sẵn đường tới các nút (dữ liệu từ API ?mo= hoặc tìm kiếm) */
  applyReveal: (data: { nodes: TreeNodeDTO[]; expand: string[] }) => void;
  reveal: (ids: string[]) => Promise<void>;
  setMatches: (ids: string[] | null) => void;
  /** Tải lại con của các cha (và cha của chúng để cập nhật số con) */
  refresh: (parentIds: (string | null)[]) => Promise<void>;
  dialog: DialogState;
  openCreate: (parent: NodeRef | null) => void;
  openMove: (node: NodeRef) => void;
  openDelete: (node: NodeRef) => void;
  closeDialog: () => void;
};

const TreeContext = createContext<TreeContextValue | null>(null);

export function useTree(): TreeContextValue {
  const ctx = useContext(TreeContext);
  if (!ctx) throw new Error("useTree phải nằm trong <TreeProvider>");
  return ctx;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok)
    throw new Error(
      ((await res.json().catch(() => null)) as { message?: string } | null)?.message ??
        "Không tải được dữ liệu cây văn bản.",
    );
  return (await res.json()) as T;
}

type Props = {
  initialRoots: TreeNodeDTO[];
  maxDepth: number;
  options: DocumentFormOptions;
  permissions: TreePermissions;
  children: React.ReactNode;
};

export function TreeProvider({
  initialRoots,
  maxDepth,
  options,
  permissions,
  children: content,
}: Props) {
  const [nodes, setNodes] = useState<Record<string, TreeNodeDTO>>(() =>
    Object.fromEntries(initialRoots.map((n) => [n.id, n])),
  );
  const [children, setChildren] = useState<Record<string, string[]>>(() => ({
    [ROOT]: initialRoots.map((n) => n.id),
  }));
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [matches, setMatchesState] = useState<Set<string> | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("manual");
  const [dialog, setDialog] = useState<DialogState>(null);
  const nodesRef = useRef(nodes);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  /** Ghi danh sách con (đầy đủ) của nhiều cha */
  const mergeGroups = useCallback((list: TreeNodeDTO[], parents: (string | null)[]) => {
    const groups = new Map<string, string[]>(parents.map((p) => [keyOf(p), []]));
    for (const n of list) {
      const k = keyOf(n.parentId);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(n.id);
    }
    setNodes((prev) => ({ ...prev, ...Object.fromEntries(list.map((n) => [n.id, n])) }));
    setChildren((prev) => ({ ...prev, ...Object.fromEntries(groups) }));
  }, []);

  const loadChildren = useCallback(
    async (parentId: string | null) => {
      const k = keyOf(parentId);
      setLoading((s) => new Set(s).add(k));
      try {
        const data = await getJson<{ nodes: TreeNodeDTO[] }>(
          `/api/documents/tree?cha=${encodeURIComponent(parentId ?? "")}`,
        );
        mergeGroups(data.nodes, [parentId]);
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setLoading((s) => {
          const next = new Set(s);
          next.delete(k);
          return next;
        });
      }
    },
    [mergeGroups],
  );

  const toggle = useCallback(
    (id: string) => {
      setExpanded((s) => {
        const next = new Set(s);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      // Tải lười: chỉ gọi máy chủ lần đầu mở nhánh
      if (!expanded.has(id) && children[id] === undefined) void loadChildren(id);
    },
    [children, expanded, loadChildren],
  );

  const applyReveal = useCallback(
    (data: { nodes: TreeNodeDTO[]; expand: string[] }) => {
      mergeGroups(data.nodes, [null, ...data.expand]);
      setExpanded((s) => new Set([...s, ...data.expand]));
    },
    [mergeGroups],
  );

  const reveal = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      try {
        applyReveal(
          await getJson<{ nodes: TreeNodeDTO[]; expand: string[] }>(
            `/api/documents/tree?mo=${ids.map(encodeURIComponent).join(",")}`,
          ),
        );
      } catch (e) {
        toast.error((e as Error).message);
      }
    },
    [applyReveal],
  );

  const expandAll = useCallback(async () => {
    try {
      const data = await getJson<{ nodes: TreeNodeDTO[]; truncated: boolean }>(
        "/api/documents/tree?tatCa=1",
      );
      const parents = [null, ...data.nodes.filter((n) => n.childCount > 0).map((n) => n.id)];
      mergeGroups(data.nodes, parents);
      setExpanded(new Set(parents.filter((p): p is string => !!p)));
      if (data.truncated) toast.info("Cây quá lớn — chỉ mở được 3.000 văn bản đầu tiên.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, [mergeGroups]);

  const refresh = useCallback(
    async (parentIds: (string | null)[]) => {
      const targets = new Set<string | null>();
      for (const p of parentIds) {
        targets.add(p);
        // Cha của nút cha → cập nhật số con hiển thị cạnh nút cha
        if (p) targets.add(nodesRef.current[p]?.parentId ?? null);
      }
      await Promise.all([...targets].map((p) => loadChildren(p)));
    },
    [loadChildren],
  );

  const value = useMemo<TreeContextValue>(
    () => ({
      maxDepth,
      options,
      permissions,
      nodes,
      children,
      expanded,
      loading,
      matches,
      sortMode,
      setSortMode,
      toggle,
      expandAll,
      collapseAll: () => setExpanded(new Set()),
      applyReveal,
      reveal,
      setMatches: (ids) => setMatchesState(ids ? new Set(ids) : null),
      refresh,
      dialog,
      openCreate: (parent) => setDialog({ kind: "create", parent }),
      openMove: (node) => setDialog({ kind: "move", node }),
      openDelete: (node) => setDialog({ kind: "delete", node }),
      closeDialog: () => setDialog(null),
    }),
    [
      maxDepth,
      options,
      permissions,
      nodes,
      children,
      expanded,
      loading,
      matches,
      sortMode,
      toggle,
      expandAll,
      applyReveal,
      reveal,
      refresh,
      dialog,
    ],
  );

  return <TreeContext.Provider value={value}>{content}</TreeContext.Provider>;
}
