import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTransaction } from "@/contexts/StatusBarContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from '@/lib/toast';
import {
  ChevronLeft,
  ChevronRight,
  Folder,
  FolderPlus,
  FileText,
  FilePlus,
  Pencil,
  Trash2,
  Save,
  X,
  ChevronDown,
  GripVertical,
  Download,
  Upload,
} from "lucide-react";
import { Kbd } from "@/components/ui/kbd";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { useKeyboardShortcut, useSaveShortcut } from "@/hooks/use-keyboard-shortcut";
import { isSoleCompanyUser } from '@/lib/permissions';
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  closestCenter,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
 
 interface HelpFolder {
   id: string;
   company_id: string;
   parent_folder_id: string | null;
   name: string;
   created_at: string;
   updated_at: string;
 }
 
 interface HelpDocument {
   id: string;
   company_id: string;
   folder_id: string | null;
   title: string;
   content: string;
   created_at: string;
   updated_at: string;
 }
 
 interface TreeFolder extends HelpFolder {
   children: TreeFolder[];
   documents: HelpDocument[];
 }
 
 const Help = () => {
   const navigate = useNavigate();
   const { user } = useAuth();
   useTransaction('help');
   const [companyId, setCompanyId] = useState<string | null>(null);
   const [isAdmin, setIsAdmin] = useState(false);
   const [folders, setFolders] = useState<HelpFolder[]>([]);
   const [documents, setDocuments] = useState<HelpDocument[]>([]);
   const [selectedDocument, setSelectedDocument] = useState<HelpDocument | null>(null);
   const [isEditing, setIsEditing] = useState(false);
   const [editContent, setEditContent] = useState("");
   const [editTitle, setEditTitle] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [activeDocument, setActiveDocument] = useState<HelpDocument | null>(null);
   
   // Dialog states
   const [folderDialogOpen, setFolderDialogOpen] = useState(false);
   const [documentDialogOpen, setDocumentDialogOpen] = useState(false);
   const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
   const [deleteFolderDialogOpen, setDeleteFolderDialogOpen] = useState(false);
   const [newFolderName, setNewFolderName] = useState("");
   const [newDocTitle, setNewDocTitle] = useState("");
   const [parentFolderId, setParentFolderId] = useState<string | null>(null);
   const [editingFolder, setEditingFolder] = useState<HelpFolder | null>(null);
   const [deletingFolder, setDeletingFolder] = useState<HelpFolder | null>(null);
 
  const fileInputRef = useRef<HTMLInputElement>(null);

  // F1 to go back
  useKeyboardShortcut('F1', () => navigate(-1));

  // Ctrl+S to save when editing
  useSaveShortcut(() => {
    if (selectedDocument) handleSaveDocument();
  }, isEditing);

  // Ctrl+E to enter edit mode for the doc in view
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
        if (selectedDocument && isAdmin && !isEditing) {
          e.preventDefault();
          setEditTitle(selectedDocument.title);
          setEditContent(selectedDocument.content);
          setIsEditing(true);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDocument, isAdmin, isEditing]);

  const handleExportMarkdown = () => {
    if (!selectedDocument) return;
    const content = isEditing ? editContent : selectedDocument.content;
    const title = isEditing ? editTitle : selectedDocument.title;
    const blob = new Blob([content || ''], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(title || 'document').replace(/[^a-z0-9-_]+/gi, '_')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Exported as Markdown');
  };

  const handleUploadMarkdown = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = '';
    if (!file || !selectedDocument) return;
    const text = await file.text();
    if (isEditing) {
      setEditContent(text);
      toast.success('Markdown loaded into editor');
    } else {
      const { error } = await supabase
        .from('help_documents')
        .update({ content: text, updated_by: user!.id })
        .eq('id', selectedDocument.id);
      if (error) {
        toast.error('Failed to upload markdown');
      } else {
        toast.success('Document replaced from Markdown');
        setSelectedDocument({ ...selectedDocument, content: text });
        fetchData();
      }
    }
  };

   useEffect(() => {
     if (user) {
       fetchUserProfile();
     }
   }, [user]);
 
   useEffect(() => {
     if (companyId) {
       fetchData();
       checkAdminRole();
     }
   }, [companyId]);
 
   const fetchUserProfile = async () => {
     const { data } = await supabase
       .from("profiles")
       .select("company_id")
       .eq("user_id", user!.id)
       .single();
     if (data) setCompanyId(data.company_id);
   };
 
   const checkAdminRole = async () => {
     const { data } = await supabase
       .from("user_roles")
       .select("role")
       .eq("user_id", user!.id)
       .eq("company_id", companyId!)
       .in("role", ["owner", "admin", "it"]);
     const sole = await isSoleCompanyUser(companyId, user!.id);
    setIsAdmin(sole || (data && data.length > 0));
   };
 
   const fetchData = async () => {
     const [foldersRes, docsRes] = await Promise.all([
       supabase.from("help_folders").select("*").eq("company_id", companyId!).order("name"),
       supabase.from("help_documents").select("*").eq("company_id", companyId!).order("title"),
     ]);
     if (foldersRes.data) setFolders(foldersRes.data);
     if (docsRes.data) setDocuments(docsRes.data);
   };
 
   const buildTree = (): { rootFolders: TreeFolder[]; rootDocuments: HelpDocument[] } => {
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
     
     const rootDocuments = documents.filter((d) => !d.folder_id);
     return { rootFolders, rootDocuments };
   };
 
   const toggleFolder = (folderId: string) => {
     setExpandedFolders((prev) => {
       const next = new Set(prev);
       if (next.has(folderId)) next.delete(folderId);
       else next.add(folderId);
       return next;
     });
   };
 
   const handleCreateFolder = async () => {
     if (!newFolderName.trim()) return;
     
     if (editingFolder) {
       const { error } = await supabase
         .from("help_folders")
         .update({ name: newFolderName })
         .eq("id", editingFolder.id);
       if (error) toast.error("Failed to update folder");
       else toast.success("Folder updated");
     } else {
       const { error } = await supabase.from("help_folders").insert({
         company_id: companyId!,
         parent_folder_id: parentFolderId,
         name: newFolderName,
       });
       if (error) toast.error("Failed to create folder");
       else toast.success("Folder created");
     }
     
     setFolderDialogOpen(false);
     setNewFolderName("");
     setParentFolderId(null);
     setEditingFolder(null);
     fetchData();
   };
 
   const handleCreateDocument = async () => {
     if (!newDocTitle.trim()) return;
     
     const { data, error } = await supabase
       .from("help_documents")
       .insert({
         company_id: companyId!,
         folder_id: parentFolderId,
         title: newDocTitle,
         content: "# " + newDocTitle + "\n\nStart writing here...",
         created_by: user!.id,
         updated_by: user!.id,
       })
       .select()
       .single();
     
     if (error) {
       toast.error("Failed to create document");
     } else {
       toast.success("Document created");
       setDocumentDialogOpen(false);
       setNewDocTitle("");
       setParentFolderId(null);
       await fetchData();
       if (data) {
         setSelectedDocument(data);
         setIsEditing(true);
         setEditContent(data.content);
         setEditTitle(data.title);
       }
     }
   };
 
   const handleSaveDocument = async () => {
     if (!selectedDocument) return;
     
     const { error } = await supabase
       .from("help_documents")
       .update({
         title: editTitle,
         content: editContent,
         updated_by: user!.id,
       })
       .eq("id", selectedDocument.id);
     
     if (error) {
       toast.error("Failed to save document");
     } else {
       toast.success("Document saved");
       setIsEditing(false);
       setSelectedDocument({ ...selectedDocument, title: editTitle, content: editContent });
       fetchData();
     }
   };
 
   const handleDeleteDocument = async () => {
     if (!selectedDocument) return;
     
     const { error } = await supabase
       .from("help_documents")
       .delete()
       .eq("id", selectedDocument.id);
     
     if (error) {
       toast.error("Failed to delete document");
     } else {
       toast.success("Document deleted");
       setSelectedDocument(null);
       setDeleteDialogOpen(false);
       fetchData();
     }
   };
 
   const handleDeleteFolder = async () => {
     if (!deletingFolder) return;
     
     const { error } = await supabase
       .from("help_folders")
       .delete()
       .eq("id", deletingFolder.id);
     
     if (error) {
       toast.error("Failed to delete folder. Make sure it's empty first.");
     } else {
       toast.success("Folder deleted");
       setDeleteFolderDialogOpen(false);
       setDeletingFolder(null);
       fetchData();
     }
   };
 
   const startEditDocument = () => {
     if (selectedDocument) {
       setEditTitle(selectedDocument.title);
       setEditContent(selectedDocument.content);
       setIsEditing(true);
     }
   };
 
   const cancelEdit = () => {
     setIsEditing(false);
     setEditContent("");
     setEditTitle("");
   };
 
   const openNewFolderDialog = (parentId: string | null = null) => {
     setParentFolderId(parentId);
     setEditingFolder(null);
     setNewFolderName("");
     setFolderDialogOpen(true);
   };
 
   const openEditFolderDialog = (folder: HelpFolder) => {
     setEditingFolder(folder);
     setNewFolderName(folder.name);
     setFolderDialogOpen(true);
   };
 
   const openNewDocumentDialog = (folderId: string | null = null) => {
     setParentFolderId(folderId);
     setNewDocTitle("");
     setDocumentDialogOpen(true);
   };
 
    const { rootFolders, rootDocuments } = buildTree();

    const handleDragStart = (event: DragStartEvent) => {
      const doc = documents.find((d) => d.id === event.active.id);
      if (doc) setActiveDocument(doc);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
      setActiveDocument(null);
      const { active, over } = event;
      if (!over || !isAdmin) return;

      const docId = active.id as string;
      const targetFolderId = over.id === "root" ? null : (over.id as string);
      
      const doc = documents.find((d) => d.id === docId);
      if (!doc || doc.folder_id === targetFolderId) return;

      const { error } = await supabase
        .from("help_documents")
        .update({ folder_id: targetFolderId })
        .eq("id", docId);

      if (error) {
        toast.error("Failed to move document");
      } else {
        toast.success("Document moved");
        fetchData();
      }
    };

    const DroppableFolder = ({ folder, depth }: { folder: TreeFolder; depth: number }) => {
      const { setNodeRef, isOver } = useDroppable({ id: folder.id });
      const isExpanded = expandedFolders.has(folder.id);

      return (
        <div key={folder.id} ref={setNodeRef}>
          <Collapsible open={isExpanded} onOpenChange={() => toggleFolder(folder.id)}>
            <div
              className={cn(
                "flex items-center gap-1 py-1.5 px-2 rounded-md hover:bg-accent group",
                "cursor-pointer",
                isOver && "bg-accent ring-2 ring-primary"
              )}
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
            >
              <CollapsibleTrigger asChild>
                <button className="p-0.5 hover:bg-accent rounded">
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform",
                      !isExpanded && "-rotate-90"
                    )}
                  />
                </button>
              </CollapsibleTrigger>
              <Folder className="h-4 w-4 text-warning shrink-0" />
              <span className="flex-1 text-sm truncate">{folder.name}</span>
              {isAdmin && (
                <div className="hidden group-hover:flex items-center gap-0.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); openNewFolderDialog(folder.id); }}
                    className="p-1 hover:bg-accent rounded"
                    title="Add subfolder"
                  >
                    <FolderPlus className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); openNewDocumentDialog(folder.id); }}
                    className="p-1 hover:bg-accent rounded"
                    title="Add document"
                  >
                    <FilePlus className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); openEditFolderDialog(folder); }}
                    className="p-1 hover:bg-accent rounded"
                    title="Rename folder"
                  >
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeletingFolder(folder); setDeleteFolderDialogOpen(true); }}
                    className="p-1 hover:bg-accent rounded"
                    title="Delete folder"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </button>
                </div>
              )}
            </div>
            <CollapsibleContent>
              {folder.children.map((child) => (
                <DroppableFolder key={child.id} folder={child} depth={depth + 1} />
              ))}
              {folder.documents.map((doc) => (
                <DraggableDocument key={doc.id} doc={doc} depth={depth + 1} />
              ))}
            </CollapsibleContent>
          </Collapsible>
        </div>
      );
    };

    const DraggableDocument = ({ doc, depth }: { doc: HelpDocument; depth: number }) => {
      const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: doc.id,
        disabled: !isAdmin,
      });

      const style = transform
        ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
        : undefined;

      return (
        <div
          ref={setNodeRef}
          style={{ ...style, paddingLeft: `${depth * 12 + 28}px` }}
          className={cn(
            "flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-accent cursor-pointer",
            selectedDocument?.id === doc.id && "bg-accent",
            isDragging && "opacity-50"
          )}
          onClick={() => { setSelectedDocument(doc); setIsEditing(false); }}
        >
          {isAdmin && (
            <div {...attributes} {...listeners} className="cursor-grab">
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          )}
          <FileText className="h-4 w-4 text-primary shrink-0" />
          <span className="flex-1 text-sm truncate">{doc.title}</span>
        </div>
      );
    };

    const RootDropZone = ({ children }: { children: React.ReactNode }) => {
      const { setNodeRef, isOver } = useDroppable({ id: "root" });
      return (
        <div ref={setNodeRef} className={cn("flex-1", isOver && "bg-accent/50")}>
          {children}
        </div>
      );
    };
 
   return (
     <div className="min-h-screen bg-background flex flex-col">
       <input
         ref={fileInputRef}
         type="file"
         accept=".md,.markdown,text/markdown,text/plain"
         className="hidden"
         onChange={handleUploadMarkdown}
       />
       {/* Header */}
       <header className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
         <div className="flex items-center justify-between h-14 px-4">
           <div className="flex items-center gap-3">
             <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="relative">
               <ChevronLeft className="h-5 w-5" />
               <Kbd className="absolute -bottom-1 -right-1 scale-75">F1</Kbd>
             </Button>
             <h1 className="text-lg font-semibold">Help Center</h1>
           </div>
         </div>
       </header>
 
       <div className="flex flex-1 overflow-hidden">
         {/* Sidebar */}
         <div
           className={cn(
             "border-r bg-muted/30 flex flex-col transition-all duration-200",
             sidebarCollapsed ? "w-12" : "w-64"
           )}
         >
           <div className="p-2 border-b flex items-center justify-between">
             {!sidebarCollapsed && (
               <span className="text-sm font-medium text-muted-foreground">Documents</span>
             )}
             <Button
               variant="ghost"
               size="icon"
               className="h-7 w-7"
               onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
             >
               {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
             </Button>
           </div>
           
           {!sidebarCollapsed && (
             <>
               {isAdmin && (
                 <div className="p-2 border-b flex gap-1">
                   <Button
                     variant="outline"
                     size="sm"
                     className="flex-1 h-8 text-xs"
                     onClick={() => openNewFolderDialog(null)}
                   >
                     <FolderPlus className="h-3.5 w-3.5 mr-1" />
                     Folder
                   </Button>
                   <Button
                     variant="outline"
                     size="sm"
                     className="flex-1 h-8 text-xs"
                     onClick={() => openNewDocumentDialog(null)}
                   >
                     <FilePlus className="h-3.5 w-3.5 mr-1" />
                     Document
                   </Button>
                 </div>
               )}
               
                <div className="flex-1 overflow-y-auto p-2">
                  <DndContext
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                  >
                    <RootDropZone>
                      {rootFolders.map((folder) => (
                        <DroppableFolder key={folder.id} folder={folder} depth={0} />
                      ))}
                      {rootDocuments.map((doc) => (
                        <DraggableDocument key={doc.id} doc={doc} depth={0} />
                      ))}
                    </RootDropZone>
                    <DragOverlay>
                      {activeDocument && (
                        <div className="flex items-center gap-2 py-1.5 px-2 rounded-md bg-accent shadow-lg">
                          <FileText className="h-4 w-4 text-primary shrink-0" />
                          <span className="text-sm">{activeDocument.title}</span>
                        </div>
                      )}
                    </DragOverlay>
                  </DndContext>
                  {folders.length === 0 && documents.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      {isAdmin ? "Create your first folder or document" : "No help documents yet"}
                    </p>
                  )}
                </div>
             </>
           )}
         </div>
 
         {/* Content Area */}
         <div className="flex-1 overflow-hidden flex flex-col">
           {selectedDocument ? (
             <>
               {/* Document Header */}
               <div className="border-b p-4 flex items-center justify-between">
                 {isEditing ? (
                   <Input
                     value={editTitle}
                     onChange={(e) => setEditTitle(e.target.value)}
                     className="text-xl font-semibold max-w-md"
                   />
                 ) : (
                   <h2 className="text-xl font-semibold">{selectedDocument.title}</h2>
                 )}
                  {isAdmin ? (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleExportMarkdown} title="Export as Markdown">
                        <Download className="h-4 w-4 mr-1" />
                        Export
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} title="Upload Markdown">
                        <Upload className="h-4 w-4 mr-1" />
                        Upload
                      </Button>
                      {isEditing ? (
                        <>
                          <Button variant="outline" size="sm" onClick={cancelEdit}>
                            <X className="h-4 w-4 mr-1" />
                            Cancel
                          </Button>
                           <Button size="sm" onClick={handleSaveDocument}>
                             <Save className="h-4 w-4 mr-1" />
                             Save
                             <Kbd>⌘S</Kbd>
                           </Button>
                        </>
                      ) : (
                        <>
                          <Button variant="outline" size="sm" onClick={startEditDocument} className="relative">
                            <Pencil className="h-4 w-4 mr-1" />
                            Edit
                            <Kbd className="ml-1">⌘E</Kbd>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteDialogOpen(true)}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Delete
                          </Button>
                        </>
                      )}
                    </div>
                  ) : (
                    <Button variant="outline" size="sm" onClick={handleExportMarkdown} title="Export as Markdown">
                      <Download className="h-4 w-4 mr-1" />
                      Export
                    </Button>
                  )}
               </div>
               
               {/* Document Content */}
               <div className="flex-1 overflow-y-auto p-6">
                 {isEditing ? (
                   <Textarea
                     value={editContent}
                     onChange={(e) => setEditContent(e.target.value)}
                     className="min-h-[500px] font-mono text-sm"
                     placeholder="Write your markdown content here..."
                   />
                 ) : (
                   <article className="prose prose-sm dark:prose-invert max-w-none">
                     <ReactMarkdown>{selectedDocument.content}</ReactMarkdown>
                   </article>
                 )}
               </div>
             </>
           ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-6">
              <div className="w-full max-w-md space-y-4">
                <div className="text-center mb-6">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Search Help Documents</p>
                </div>
                <Input
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full"
                  autoFocus
                />
                {searchQuery.trim() && (
                  <div className="bg-background border rounded-md max-h-64 overflow-y-auto">
                    {documents
                      .filter((doc) =>
                        doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (doc.content && doc.content.toLowerCase().includes(searchQuery.toLowerCase()))
                      )
                      .map((doc) => (
                        <div
                          key={doc.id}
                          onClick={() => {
                            setSelectedDocument(doc);
                            setSearchQuery("");
                            setIsEditing(false);
                          }}
                          className="flex items-center gap-2 p-3 hover:bg-accent cursor-pointer border-b last:border-b-0"
                        >
                          <FileText className="h-4 w-4 text-primary shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{doc.title}</p>
                            {doc.content && (
                              <p className="text-xs text-muted-foreground truncate">
                                {doc.content.substring(0, 100)}...
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    {documents.filter((doc) =>
                      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      (doc.content && doc.content.toLowerCase().includes(searchQuery.toLowerCase()))
                    ).length === 0 && (
                      <p className="p-3 text-sm text-center">No documents found</p>
                    )}
                  </div>
                )}
              </div>
            </div>
           )}
         </div>
       </div>
 
       {/* Create/Edit Folder Dialog */}
       <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
         <DialogContent>
           <DialogHeader>
             <DialogTitle>{editingFolder ? "Rename Folder" : "Create Folder"}</DialogTitle>
           </DialogHeader>
          <div className="px-6 py-6">
            <Input
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
              autoFocus
            />
          </div>
           <DialogFooter>
             <Button onClick={handleCreateFolder}>
               {editingFolder ? "Save" : "Create"}
             </Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>
 
       {/* Create Document Dialog */}
       <Dialog open={documentDialogOpen} onOpenChange={setDocumentDialogOpen}>
         <DialogContent>
           <DialogHeader>
             <DialogTitle>Create Document</DialogTitle>
           </DialogHeader>
           <Input
             placeholder="Document title"
             value={newDocTitle}
             onChange={(e) => setNewDocTitle(e.target.value)}
             onKeyDown={(e) => e.key === "Enter" && handleCreateDocument()}
           />
           <DialogFooter>
             <Button variant="outline" onClick={() => setDocumentDialogOpen(false)}>
               Cancel
             </Button>
             <Button onClick={handleCreateDocument}>Create</Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>
 
       {/* Delete Document Confirmation */}
       <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
         <AlertDialogContent>
           <AlertDialogHeader>
             <AlertDialogTitle>Delete Document</AlertDialogTitle>
             <AlertDialogDescription>
               Are you sure you want to delete "{selectedDocument?.title}"? This action cannot be undone.
             </AlertDialogDescription>
           </AlertDialogHeader>
           <AlertDialogFooter>
             <AlertDialogCancel>Cancel</AlertDialogCancel>
             <AlertDialogAction onClick={handleDeleteDocument} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
               Delete
             </AlertDialogAction>
           </AlertDialogFooter>
         </AlertDialogContent>
       </AlertDialog>
 
       {/* Delete Folder Confirmation */}
       <AlertDialog open={deleteFolderDialogOpen} onOpenChange={setDeleteFolderDialogOpen}>
         <AlertDialogContent>
           <AlertDialogHeader>
             <AlertDialogTitle>Delete Folder</AlertDialogTitle>
             <AlertDialogDescription>
               Are you sure you want to delete "{deletingFolder?.name}"? The folder must be empty to be deleted.
             </AlertDialogDescription>
           </AlertDialogHeader>
           <AlertDialogFooter>
             <AlertDialogCancel onClick={() => setDeletingFolder(null)}>Cancel</AlertDialogCancel>
             <AlertDialogAction onClick={handleDeleteFolder} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
               Delete
             </AlertDialogAction>
           </AlertDialogFooter>
         </AlertDialogContent>
       </AlertDialog>
     </div>
   );
 };
 
 export default Help;