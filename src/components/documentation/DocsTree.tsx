import { useState } from "react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  ChevronDown,
  ChevronUp,
  Folder,
  FolderPlus,
  FilePlus,
  FileText,
  GripVertical,
  Pencil,
  Trash2,
} from "lucide-react";

export interface DocFolder {
  id: string;
  parent_folder_id: string | null;
  name: string;
  sort_order?: number | null;
}

export interface PlatformDoc {
  id: string;
  folder_id: string | null;
  title: string;
  content: string;
  sort_order?: number | null;
}

export type ItemKind = "folder" | "doc";

export interface TreeRef {
  kind: ItemKind;
  id: string;
}

export interface TreeFolder extends DocFolder {
  items: TreeItem[];
}

export type TreeItem =
  | { kind: "folder"; id: string; order: number; label: string; folder: TreeFolder }
  | { kind: "doc"; id: string; order: number; label: string; doc: PlatformDoc };

const compareItems = (a: TreeItem, b: TreeItem) => {
  if (a.order !== b.order) return a.order - b.order;
  return a.label.localeCompare(b.label);
};

export const buildDocTree = (folders: DocFolder[], documents: PlatformDoc[]) => {
  const folderMap = new Map<string, TreeFolder>();
  folders.forEach((f) => folderMap.set(f.id, { ...f, items: [] }));

  const rootItems: TreeItem[] = [];

  folders.forEach((f) => {
    const node = folderMap.get(f.id)!;
    const item: TreeItem = {
      kind: "folder",
      id: f.id,
      order: f.sort_order ?? 0,
      label: f.name,
      folder: node,
    };
    if (f.parent_folder_id && folderMap.has(f.parent_folder_id)) {
      folderMap.get(f.parent_folder_id)!.items.push(item);
    } else {
      rootItems.push(item);
    }
  });

  documents.forEach((d) => {
    const item: TreeItem = {
      kind: "doc",
      id: d.id,
      order: d.sort_order ?? 0,
      label: d.title,
      doc: d,
    };
    if (d.folder_id && folderMap.has(d.folder_id)) {
      folderMap.get(d.folder_id)!.items.push(item);
    } else {
      rootItems.push(item);
    }
  });

  const sortNode = (items: TreeItem[]) => {
    items.sort(compareItems);
    items.forEach((i) => {
      if (i.kind === "folder") sortNode(i.folder.items);
    });
  };
  sortNode(rootItems);

  return { rootItems, folderMap };
};

/** Documents in the exact order they are presented in the tree — used for next/previous navigation. */
export const flattenDocOrder = (folders: DocFolder[], documents: PlatformDoc[]): PlatformDoc[] => {
  const { rootItems } = buildDocTree(folders, documents);
  const out: PlatformDoc[] = [];
  const walk = (items: TreeItem[]) => {
    items.forEach((i) => {
      if (i.kind === "doc") out.push(i.doc);
      else walk(i.folder.items);
    });
  };
  walk(rootItems);
  return out;
};

type DropPosition = "before" | "after" | "inside";

interface TreeProps {
  folders: DocFolder[];
  documents: PlatformDoc[];
  selectedId?: string | null;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (doc: PlatformDoc) => void;
  editable?: boolean;
  onAddFolder?: (parentId: string | null) => void;
  onAddDocument?: (folderId: string | null) => void;
  onRenameFolder?: (folder: DocFolder) => void;
  onDeleteFolder?: (folder: DocFolder) => void;
  /** Persist a move: dragged item goes under newParentId, siblings listed in final order. */
  onRelocate?: (dragged: TreeRef, newParentId: string | null, ordered: TreeRef[]) => void;
}

export const DocsTree = (props: TreeProps) => {
  const { rootItems, folderMap } = buildDocTree(props.folders, props.documents);
  const [dragging, setDragging] = useState<TreeRef | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; position: DropPosition } | null>(null);

  const parentOf = (ref: TreeRef): string | null => {
    if (ref.kind === "folder") return props.folders.find((f) => f.id === ref.id)?.parent_folder_id ?? null;
    return props.documents.find((d) => d.id === ref.id)?.folder_id ?? null;
  };

  const siblingsOf = (parentId: string | null): TreeItem[] =>
    parentId ? folderMap.get(parentId)?.items ?? [] : rootItems;

  const isDescendant = (folderId: string, maybeChildId: string | null): boolean => {
    let current = maybeChildId;
    while (current) {
      if (current === folderId) return true;
      current = props.folders.find((f) => f.id === current)?.parent_folder_id ?? null;
    }
    return false;
  };

  const relocate = (dragged: TreeRef, newParentId: string | null, index: number) => {
    if (!props.onRelocate) return;
    if (dragged.kind === "folder" && (dragged.id === newParentId || isDescendant(dragged.id, newParentId))) return;
    const siblings = siblingsOf(newParentId)
      .filter((i) => !(i.kind === dragged.kind && i.id === dragged.id))
      .map<TreeRef>((i) => ({ kind: i.kind, id: i.id }));
    const clamped = Math.max(0, Math.min(index, siblings.length));
    siblings.splice(clamped, 0, dragged);
    props.onRelocate(dragged, newParentId, siblings);
  };

  const move = (ref: TreeRef, direction: -1 | 1) => {
    const parentId = parentOf(ref);
    const siblings = siblingsOf(parentId);
    const idx = siblings.findIndex((i) => i.kind === ref.kind && i.id === ref.id);
    const target = idx + direction;
    if (idx < 0 || target < 0 || target >= siblings.length) return;
    relocate(ref, parentId, target);
  };

  const handleDrop = (target: TreeItem) => {
    const dragged = dragging;
    const position = dropTarget?.position ?? "before";
    setDragging(null);
    setDropTarget(null);
    if (!dragged) return;
    if (dragged.kind === target.kind && dragged.id === target.id) return;

    if (position === "inside" && target.kind === "folder") {
      relocate(dragged, target.id, target.folder.items.length);
      return;
    }
    const parentId = parentOf({ kind: target.kind, id: target.id });
    const siblings = siblingsOf(parentId).filter(
      (i) => !(i.kind === dragged.kind && i.id === dragged.id),
    );
    const targetIdx = siblings.findIndex((i) => i.kind === target.kind && i.id === target.id);
    relocate(dragged, parentId, position === "after" ? targetIdx + 1 : targetIdx);
  };

  const dragProps = (item: TreeItem) => {
    if (!props.editable || !props.onRelocate) return {};
    return {
      draggable: true,
      onDragStart: (e: React.DragEvent) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", item.id);
        setDragging({ kind: item.kind, id: item.id });
      },
      onDragEnd: () => { setDragging(null); setDropTarget(null); },
      onDragOver: (e: React.DragEvent) => {
        if (!dragging) return;
        e.preventDefault();
        e.stopPropagation();
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const ratio = (e.clientY - rect.top) / rect.height;
        let position: DropPosition;
        if (item.kind === "folder") {
          position = ratio < 0.3 ? "before" : ratio > 0.75 ? "after" : "inside";
        } else {
          position = ratio < 0.5 ? "before" : "after";
        }
        setDropTarget({ id: item.id, position });
      },
      onDragLeave: (e: React.DragEvent) => {
        e.stopPropagation();
        setDropTarget((prev) => (prev?.id === item.id ? null : prev));
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        handleDrop(item);
      },
    };
  };

  const dropClasses = (item: TreeItem) => {
    const active = dropTarget?.id === item.id;
    return cn(
      active && dropTarget?.position === "before" && "border-t-2 border-primary",
      active && dropTarget?.position === "after" && "border-b-2 border-primary",
      active && dropTarget?.position === "inside" && "ring-2 ring-primary ring-inset bg-primary/5",
      dragging?.id === item.id && "opacity-50",
    );
  };

  const moveButtons = (item: TreeItem, siblings: TreeItem[]) => {
    const idx = siblings.findIndex((i) => i.kind === item.kind && i.id === item.id);
    return (
      <div className="flex items-center gap-0.5">
        <button
          onClick={(e) => { e.stopPropagation(); move({ kind: item.kind, id: item.id }, -1); }}
          disabled={idx <= 0}
          className="p-1 hover:bg-accent rounded disabled:opacity-30"
          title="Move up"
        >
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); move({ kind: item.kind, id: item.id }, 1); }}
          disabled={idx < 0 || idx >= siblings.length - 1}
          className="p-1 hover:bg-accent rounded disabled:opacity-30"
          title="Move down"
        >
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
    );
  };

  const renderDoc = (item: TreeItem & { kind: "doc" }, depth: number, siblings: TreeItem[]) => (
    <div
      key={`doc-${item.id}`}
      style={{ paddingLeft: `${depth * 12 + 20}px` }}
      className={cn(
        "flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-accent cursor-pointer group",
        props.selectedId === item.id && "bg-accent",
        dropClasses(item),
      )}
      onClick={() => props.onSelect(item.doc)}
      {...dragProps(item)}
    >
      {props.editable && props.onRelocate && (
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0 cursor-grab" />
      )}
      <FileText className="h-4 w-4 text-primary shrink-0" />
      <span className="flex-1 text-sm truncate">{item.label}</span>
      {props.editable && props.onRelocate && moveButtons(item, siblings)}
    </div>
  );

  const renderFolder = (item: TreeItem & { kind: "folder" }, depth: number, siblings: TreeItem[]) => {
    const folder = item.folder;
    const isExpanded = props.expanded.has(folder.id);
    return (
      <div key={`folder-${folder.id}`}>
        <Collapsible open={isExpanded} onOpenChange={() => props.onToggle(folder.id)}>
          <div
            className={cn(
              "flex items-center gap-1 py-1.5 px-2 rounded-md hover:bg-accent group cursor-pointer",
              dropClasses(item),
            )}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
            {...dragProps(item)}
          >
            {props.editable && props.onRelocate && (
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0 cursor-grab" />
            )}
            <CollapsibleTrigger asChild>
              <button className="p-0.5 hover:bg-accent rounded">
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform",
                    !isExpanded && "-rotate-90",
                  )}
                />
              </button>
            </CollapsibleTrigger>
            <Folder className="h-4 w-4 text-warning shrink-0" />
            <span className="flex-1 text-sm truncate">{folder.name}</span>
            {props.editable && props.onRelocate && moveButtons(item, siblings)}
            {props.editable && (
              <div className="hidden group-hover:flex items-center gap-0.5">
                <button
                  onClick={(e) => { e.stopPropagation(); props.onAddFolder?.(folder.id); }}
                  className="p-1 hover:bg-accent rounded"
                  title="Add subfolder"
                >
                  <FolderPlus className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); props.onAddDocument?.(folder.id); }}
                  className="p-1 hover:bg-accent rounded"
                  title="Add document"
                >
                  <FilePlus className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); props.onRenameFolder?.(folder); }}
                  className="p-1 hover:bg-accent rounded"
                  title="Rename folder"
                >
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); props.onDeleteFolder?.(folder); }}
                  className="p-1 hover:bg-accent rounded"
                  title="Delete folder"
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </button>
              </div>
            )}
          </div>
          <CollapsibleContent>
            {folder.items.map((child) => renderItem(child, depth + 1, folder.items))}
          </CollapsibleContent>
        </Collapsible>
      </div>
    );
  };

  const renderItem = (item: TreeItem, depth: number, siblings: TreeItem[]) =>
    item.kind === "folder" ? renderFolder(item, depth, siblings) : renderDoc(item, depth, siblings);

  return (
    <div>
      {rootItems.map((item) => renderItem(item, 0, rootItems))}
      {props.editable && props.onRelocate && (
        <div
          className={cn(
            "mt-1 h-8 rounded-md border border-dashed text-xs text-muted-foreground flex items-center justify-center",
            dragging ? "opacity-100" : "opacity-0 pointer-events-none",
            dropTarget?.id === "__root__" && "border-primary bg-primary/5",
          )}
          onDragOver={(e) => { e.preventDefault(); setDropTarget({ id: "__root__", position: "after" }); }}
          onDragLeave={() => setDropTarget((prev) => (prev?.id === "__root__" ? null : prev))}
          onDrop={(e) => {
            e.preventDefault();
            const dragged = dragging;
            setDragging(null);
            setDropTarget(null);
            if (dragged) relocate(dragged, null, rootItems.length);
          }}
        >
          Drop here to move to top level
        </div>
      )}
    </div>
  );
};
