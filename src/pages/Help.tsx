 import { useState, useEffect } from "react";
 import { useNavigate } from "react-router-dom";
 import { useAuth } from "@/contexts/AuthContext";
 import { supabase } from "@/integrations/supabase/client";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Textarea } from "@/components/ui/textarea";
 import { toast } from "sonner";
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
 } from "lucide-react";
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
     setIsAdmin(data && data.length > 0);
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
 
   const renderFolder = (folder: TreeFolder, depth: number = 0) => {
     const isExpanded = expandedFolders.has(folder.id);
     
     return (
       <div key={folder.id}>
         <Collapsible open={isExpanded} onOpenChange={() => toggleFolder(folder.id)}>
           <div
             className={cn(
               "flex items-center gap-1 py-1.5 px-2 rounded-md hover:bg-accent group",
               "cursor-pointer"
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
             {folder.children.map((child) => renderFolder(child, depth + 1))}
             {folder.documents.map((doc) => renderDocument(doc, depth + 1))}
           </CollapsibleContent>
         </Collapsible>
       </div>
     );
   };
 
   const renderDocument = (doc: HelpDocument, depth: number = 0) => (
     <div
       key={doc.id}
       onClick={() => { setSelectedDocument(doc); setIsEditing(false); }}
       className={cn(
         "flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-accent cursor-pointer",
         selectedDocument?.id === doc.id && "bg-accent"
       )}
       style={{ paddingLeft: `${depth * 12 + 28}px` }}
     >
      <FileText className="h-4 w-4 text-primary shrink-0" />
       <span className="flex-1 text-sm truncate">{doc.title}</span>
     </div>
   );
 
   return (
     <div className="min-h-screen bg-background flex flex-col">
       {/* Header */}
       <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
         <div className="flex items-center justify-between h-14 px-4">
           <div className="flex items-center gap-3">
             <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
               <ChevronLeft className="h-5 w-5" />
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
                 {rootFolders.map((folder) => renderFolder(folder))}
                 {rootDocuments.map((doc) => renderDocument(doc))}
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
                 {isAdmin && (
                   <div className="flex gap-2">
                     {isEditing ? (
                       <>
                         <Button variant="outline" size="sm" onClick={cancelEdit}>
                           <X className="h-4 w-4 mr-1" />
                           Cancel
                         </Button>
                         <Button size="sm" onClick={handleSaveDocument}>
                           <Save className="h-4 w-4 mr-1" />
                           Save
                         </Button>
                       </>
                     ) : (
                       <>
                         <Button variant="outline" size="sm" onClick={startEditDocument}>
                           <Pencil className="h-4 w-4 mr-1" />
                           Edit
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
             <div className="flex-1 flex items-center justify-center text-muted-foreground">
               <div className="text-center">
                 <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                 <p>Select a document to view</p>
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