import { useState, useEffect, useRef, useCallback } from "react";
import { platformAdminSupabase as sb } from "@/integrations/supabase/platformAdminClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/lib/toast";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { Kbd } from "@/components/ui/kbd";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import {
  ChevronLeft,
  ChevronRight,
  FilePlus,
  FolderPlus,
  FileText,
  Pencil,
  Save,
  Shield,
  Trash2,
  X,
  Download,
  Upload,
  LogOut,
} from "lucide-react";
import { DocsTree, flattenDocOrder, type DocFolder, type PlatformDoc } from "@/components/documentation/DocsTree";

const PlatformAdmin = () => {
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);

  const [folders, setFolders] = useState<DocFolder[]>([]);
  const [documents, setDocuments] = useState<PlatformDoc[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<PlatformDoc | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [documentDialogOpen, setDocumentDialogOpen] = useState(false);
  const [deleteDocOpen, setDeleteDocOpen] = useState(false);
  const [deleteFolderOpen, setDeleteFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newDocTitle, setNewDocTitle] = useState("");
  const [parentFolderId, setParentFolderId] = useState<string | null>(null);
  const [editingFolder, setEditingFolder] = useState<DocFolder | null>(null);
  const [deletingFolder, setDeletingFolder] = useState<DocFolder | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const verifySession = useCallback(async () => {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) {
      setIsAdmin(false);
      setChecking(false);
      return;
    }
    const { data } = await sb
      .from("platform_admins")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    setIsAdmin(!!data);
    setChecking(false);
  }, []);

  useEffect(() => { verifySession(); }, [verifySession]);

  const fetchData = useCallback(async () => {
    const [foldersRes, docsRes] = await Promise.all([
      sb.from("platform_doc_folders").select("*").order("sort_order").order("name"),
      sb.from("platform_documents").select("*").order("sort_order").order("title"),
    ]);
    if (foldersRes.data) setFolders(foldersRes.data as DocFolder[]);
    if (docsRes.data) setDocuments(docsRes.data as PlatformDoc[]);
  }, []);

  const orderedDocs = flattenDocOrder(folders, documents);
  const currentIndex = selectedDocument
    ? orderedDocs.findIndex((d) => d.id === selectedDocument.id)
    : -1;
  const prevDoc = currentIndex > 0 ? orderedDocs[currentIndex - 1] : null;
  const nextDoc =
    currentIndex >= 0 && currentIndex < orderedDocs.length - 1 ? orderedDocs[currentIndex + 1] : null;

  const persistOrder = async (
    table: "platform_doc_folders" | "platform_documents",
    ids: string[],
  ) => {
    await Promise.all(
      ids.map((id, i) => sb.from(table).update({ sort_order: i }).eq("id", id)),
    );
    fetchData();
  };

  const moveItem = <T extends { id: string }>(items: T[], id: string, direction: -1 | 1) => {
    const idx = items.findIndex((i) => i.id === id);
    const target = idx + direction;
    if (idx < 0 || target < 0 || target >= items.length) return null;
    const next = [...items];
    [next[idx], next[target]] = [next[target], next[idx]];
    return next.map((i) => i.id);
  };

  useEffect(() => { if (isAdmin) fetchData(); }, [isAdmin, fetchData]);

  const handleSaveDocument = useCallback(async () => {
    if (!selectedDocument) return;
    const { data: { user } } = await sb.auth.getUser();
    const { error } = await sb
      .from("platform_documents")
      .update({ title: editTitle, content: editContent, updated_by: user?.id ?? null })
      .eq("id", selectedDocument.id);
    if (error) {
      toast.error("Failed to save document");
    } else {
      toast.success("Document saved");
      setIsEditing(false);
      setSelectedDocument({ ...selectedDocument, title: editTitle, content: editContent });
      fetchData();
    }
  }, [selectedDocument, editTitle, editContent, fetchData]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod || !isAdmin) return;
      const key = e.key.toLowerCase();
      if (key === "e" && selectedDocument && !isEditing) {
        e.preventDefault();
        setEditTitle(selectedDocument.title);
        setEditContent(selectedDocument.content);
        setIsEditing(true);
      }
      if (key === "s" && isEditing) {
        e.preventDefault();
        handleSaveDocument();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedDocument, isEditing, isAdmin, handleSaveDocument]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSigningIn(true);
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      toast.error("Invalid credentials");
      setSigningIn(false);
      return;
    }
    await verifySession();
    setSigningIn(false);
    setPassword("");
  };

  const handleSignOut = async () => {
    await sb.auth.signOut();
    setIsAdmin(false);
    setSelectedDocument(null);
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
      const { error } = await sb
        .from("platform_doc_folders")
        .update({ name: newFolderName })
        .eq("id", editingFolder.id);
      if (error) toast.error("Failed to update folder");
      else toast.success("Folder updated");
    } else {
      const { error } = await sb
        .from("platform_doc_folders")
        .insert({
          parent_folder_id: parentFolderId,
          name: newFolderName,
          sort_order: folders.filter((f) => f.parent_folder_id === parentFolderId).length,
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
    const { data: { user } } = await sb.auth.getUser();
    const { data, error } = await sb
      .from("platform_documents")
      .insert({
        folder_id: parentFolderId,
        title: newDocTitle,
        content: "# " + newDocTitle + "\n\nStart writing here...",
        created_by: user?.id ?? null,
        updated_by: user?.id ?? null,
        sort_order: documents.filter((d) => d.folder_id === parentFolderId).length,
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
        const doc = data as PlatformDoc;
        setSelectedDocument(doc);
        setEditTitle(doc.title);
        setEditContent(doc.content);
        setIsEditing(true);
      }
    }
  };

  const handleDeleteDocument = async () => {
    if (!selectedDocument) return;
    const { error } = await sb.from("platform_documents").delete().eq("id", selectedDocument.id);
    if (error) {
      toast.error("Failed to delete document");
    } else {
      toast.success("Document deleted");
      setSelectedDocument(null);
      setDeleteDocOpen(false);
      fetchData();
    }
  };

  const handleDeleteFolder = async () => {
    if (!deletingFolder) return;
    const { error } = await sb.from("platform_doc_folders").delete().eq("id", deletingFolder.id);
    if (error) {
      toast.error("Failed to delete folder. Make sure it's empty first.");
    } else {
      toast.success("Folder deleted");
      setDeleteFolderOpen(false);
      setDeletingFolder(null);
      fetchData();
    }
  };

  const handleExportMarkdown = () => {
    if (!selectedDocument) return;
    const content = isEditing ? editContent : selectedDocument.content;
    const title = isEditing ? editTitle : selectedDocument.title;
    const blob = new Blob([content || ""], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(title || "document").replace(/[^a-z0-9-_]+/gi, "_")}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Exported as Markdown");
  };

  const handleUploadMarkdown = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = "";
    if (!file || !selectedDocument) return;
    const text = await file.text();
    if (isEditing) {
      setEditContent(text);
      toast.success("Markdown loaded into editor");
      return;
    }
    const { error } = await sb
      .from("platform_documents")
      .update({ content: text })
      .eq("id", selectedDocument.id);
    if (error) {
      toast.error("Failed to upload markdown");
    } else {
      toast.success("Document replaced from Markdown");
      setSelectedDocument({ ...selectedDocument, content: text });
      fetchData();
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <Shield className="h-10 w-10 mx-auto mb-2 text-primary" />
            <CardTitle>Platform Admin</CardTitle>
            <CardDescription>Sign in to manage platform documentation</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pa-email">Email</Label>
                <Input
                  id="pa-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pa-password">Password</Label>
                <Input
                  id="pa-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={signingIn}>
                {signingIn ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.markdown,text/markdown,text/plain"
        className="hidden"
        onChange={handleUploadMarkdown}
      />
      <header className="bg-background/95 backdrop-blur sticky top-0 z-50 border-b">
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Platform Admin — Documentation</h1>
          </div>
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-1" />
            Sign out
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
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
              <div className="p-2 border-b flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-8 text-xs"
                  onClick={() => { setParentFolderId(null); setEditingFolder(null); setNewFolderName(""); setFolderDialogOpen(true); }}
                >
                  <FolderPlus className="h-3.5 w-3.5 mr-1" />
                  Folder
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-8 text-xs"
                  onClick={() => { setParentFolderId(null); setNewDocTitle(""); setDocumentDialogOpen(true); }}
                >
                  <FilePlus className="h-3.5 w-3.5 mr-1" />
                  Document
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                <DocsTree
                  folders={folders}
                  documents={documents}
                  selectedId={selectedDocument?.id}
                  expanded={expandedFolders}
                  onToggle={toggleFolder}
                  onSelect={(doc) => { setSelectedDocument(doc); setIsEditing(false); }}
                  editable
                  onAddFolder={(parentId) => { setParentFolderId(parentId); setEditingFolder(null); setNewFolderName(""); setFolderDialogOpen(true); }}
                  onAddDocument={(folderId) => { setParentFolderId(folderId); setNewDocTitle(""); setDocumentDialogOpen(true); }}
                  onRenameFolder={(folder) => { setEditingFolder(folder); setNewFolderName(folder.name); setFolderDialogOpen(true); }}
                  onDeleteFolder={(folder) => { setDeletingFolder(folder); setDeleteFolderOpen(true); }}
                  onMoveFolder={(folder, direction, siblings) => {
                    const ids = moveItem(siblings, folder.id, direction);
                    if (ids) persistOrder("platform_doc_folders", ids);
                  }}
                  onMoveDocument={(doc, direction, siblings) => {
                    const ids = moveItem(siblings, doc.id, direction);
                    if (ids) persistOrder("platform_documents", ids);
                  }}
                />
                {folders.length === 0 && documents.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Create your first folder or document
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          {selectedDocument ? (
            <>
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
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleExportMarkdown}>
                    <Download className="h-4 w-4 mr-1" />
                    Export
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-1" />
                    Upload
                  </Button>
                  {isEditing ? (
                    <>
                      <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                        <X className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                      <Button size="sm" onClick={handleSaveDocument}>
                        <Save className="h-4 w-4 mr-1" />
                        Save
                        <Kbd className="ml-1">⌘S</Kbd>
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditTitle(selectedDocument.title);
                          setEditContent(selectedDocument.content);
                          setIsEditing(true);
                        }}
                      >
                        <Pencil className="h-4 w-4 mr-1" />
                        Edit
                        <Kbd className="ml-1">⌘E</Kbd>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteDocOpen(true)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              </div>
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
              <div className="border-t p-3 flex items-center justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!prevDoc}
                  onClick={() => { if (prevDoc) { setSelectedDocument(prevDoc); setIsEditing(false); } }}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  {prevDoc ? prevDoc.title : "Previous"}
                </Button>
                <span className="text-xs text-muted-foreground">
                  {currentIndex >= 0 ? `${currentIndex + 1} of ${orderedDocs.length}` : ""}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!nextDoc}
                  onClick={() => { if (nextDoc) { setSelectedDocument(nextDoc); setIsEditing(false); } }}
                >
                  {nextDoc ? nextDoc.title : "Next"}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <FileText className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">Select or create a document</p>
              <p className="text-sm">These documents appear in the Documentation app for every user.</p>
            </div>
          )}
        </div>
      </div>

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
            <Button onClick={handleCreateFolder}>{editingFolder ? "Save" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={documentDialogOpen} onOpenChange={setDocumentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Document</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-6">
            <Input
              placeholder="Document title"
              value={newDocTitle}
              onChange={(e) => setNewDocTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateDocument()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button onClick={handleCreateDocument}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDocOpen} onOpenChange={setDeleteDocOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedDocument?.title}"? This cannot be undone.
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

      <AlertDialog open={deleteFolderOpen} onOpenChange={setDeleteFolderOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Folder</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingFolder?.name}"? The folder must be empty.
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

export default PlatformAdmin;
