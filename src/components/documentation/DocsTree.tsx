import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  ChevronDown,
  ChevronUp,
  Folder,
  FolderPlus,
  FilePlus,
  FileText,
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

export interface TreeFolder extends DocFolder {
  children: TreeFolder[];
  documents: PlatformDoc[];
}

const byOrder = <T extends { sort_order?: number | null }>(a: T, b: T, aLabel: string, bLabel: string) => {
  const ao = a.sort_order ?? 0;
  const bo = b.sort_order ?? 0;
  if (ao !== bo) return ao - bo;
  return aLabel.localeCompare(bLabel);
};

export const buildDocTree = (folders: DocFolder[], documents: PlatformDoc[]) => {
  const folderMap = new Map<string, TreeFolder>();
  folders.forEach((f) => folderMap.set(f.id, { ...f, children: [], documents: [] }));

  const rootFolders: TreeFolder[] = [];
  folderMap.forEach((folder) => {
    if (folder.parent_folder_id && folderMap.has(folder.parent_folder_id)) {
      folderMap.get(folder.parent_folder_id)!.children.push(folder);
    } else if (!folder.parent_folder_id) {
      rootFolders.push(folder);
    }
  });

  documents.forEach((doc) => {
    if (doc.folder_id && folderMap.has(doc.folder_id)) {
      folderMap.get(doc.folder_id)!.documents.push(doc);
    }
  });

  const sortFolder = (f: TreeFolder) => {
    f.children.sort((a, b) => byOrder(a, b, a.name, b.name));
    f.documents.sort((a, b) => byOrder(a, b, a.title, b.title));
    f.children.forEach(sortFolder);
  };
  rootFolders.forEach(sortFolder);
  rootFolders.sort((a, b) => byOrder(a, b, a.name, b.name));

  const rootDocuments = documents
    .filter((d) => !d.folder_id)
    .sort((a, b) => byOrder(a, b, a.title, b.title));

  return { rootFolders, rootDocuments };
};

/** Documents in the exact order they are presented in the tree — used for next/previous navigation. */
export const flattenDocOrder = (folders: DocFolder[], documents: PlatformDoc[]): PlatformDoc[] => {
  const { rootFolders, rootDocuments } = buildDocTree(folders, documents);
  const out: PlatformDoc[] = [];
  const walk = (f: TreeFolder) => {
    f.documents.forEach((d) => out.push(d));
    f.children.forEach(walk);
  };
  rootFolders.forEach(walk);
  rootDocuments.forEach((d) => out.push(d));
  return out;
};

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
  onMoveFolder?: (folder: DocFolder, direction: -1 | 1, siblings: DocFolder[]) => void;
  onMoveDocument?: (doc: PlatformDoc, direction: -1 | 1, siblings: PlatformDoc[]) => void;
}

export const DocsTree = (props: TreeProps) => {
  const { rootFolders, rootDocuments } = buildDocTree(props.folders, props.documents);

  const moveButtons = (
    canUp: boolean,
    canDown: boolean,
    up: () => void,
    down: () => void,
  ) => (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); up(); }}
        disabled={!canUp}
        className="p-1 hover:bg-accent rounded disabled:opacity-30"
        title="Move up"
      >
        <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); down(); }}
        disabled={!canDown}
        className="p-1 hover:bg-accent rounded disabled:opacity-30"
        title="Move down"
      >
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
    </>
  );

  const renderDoc = (doc: PlatformDoc, depth: number, siblings: PlatformDoc[]) => {
    const idx = siblings.findIndex((d) => d.id === doc.id);
    return (
      <div
        key={doc.id}
        style={{ paddingLeft: `${depth * 12 + 28}px` }}
        className={cn(
          "flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-accent cursor-pointer group",
          props.selectedId === doc.id && "bg-accent",
        )}
        onClick={() => props.onSelect(doc)}
      >
        <FileText className="h-4 w-4 text-primary shrink-0" />
        <span className="flex-1 text-sm truncate">{doc.title}</span>
        {props.editable && props.onMoveDocument && (
          <div className="flex items-center gap-0.5">
            {moveButtons(
              idx > 0,
              idx < siblings.length - 1,
              () => props.onMoveDocument!(doc, -1, siblings),
              () => props.onMoveDocument!(doc, 1, siblings),
            )}
          </div>
        )}
      </div>
    );
  };

  const renderFolder = (folder: TreeFolder, depth: number, siblings: TreeFolder[]) => {
    const isExpanded = props.expanded.has(folder.id);
    const idx = siblings.findIndex((f) => f.id === folder.id);
    return (
      <div key={folder.id}>
        <Collapsible open={isExpanded} onOpenChange={() => props.onToggle(folder.id)}>
          <div
            className="flex items-center gap-1 py-1.5 px-2 rounded-md hover:bg-accent group cursor-pointer"
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
          >
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
            {props.editable && props.onMoveFolder && (
              <div className="flex items-center gap-0.5">
                {moveButtons(
                  idx > 0,
                  idx < siblings.length - 1,
                  () => props.onMoveFolder!(folder, -1, siblings),
                  () => props.onMoveFolder!(folder, 1, siblings),
                )}
              </div>
            )}
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
            {folder.children.map((child) => renderFolder(child, depth + 1, folder.children))}
            {folder.documents.map((doc) => renderDoc(doc, depth + 1, folder.documents))}
          </CollapsibleContent>
        </Collapsible>
      </div>
    );
  };

  return (
    <div>
      {rootFolders.map((f) => renderFolder(f, 0, rootFolders))}
      {rootDocuments.map((d) => renderDoc(d, 0, rootDocuments))}
    </div>
  );
};
