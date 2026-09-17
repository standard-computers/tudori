import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTransaction } from "@/contexts/StatusBarContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { ChevronLeft, ChevronRight, FileText, Download, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";
import { toast } from "@/lib/toast";
import { DocsTree, flattenDocOrder, type DocFolder, type PlatformDoc } from "@/components/documentation/DocsTree";

const Documentation = () => {
  const navigate = useNavigate();
  useTransaction('documentation');
  const [folders, setFolders] = useState<DocFolder[]>([]);
  const [documents, setDocuments] = useState<PlatformDoc[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<PlatformDoc | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  useKeyboardShortcut('F1', () => navigate(-1));

  useEffect(() => {
    const load = async () => {
      const [foldersRes, docsRes] = await Promise.all([
        supabase.from('platform_doc_folders').select('*').order('sort_order').order('name'),
        supabase.from('platform_documents').select('*').order('sort_order').order('title'),
      ]);
      if (foldersRes.data) setFolders(foldersRes.data as DocFolder[]);
      if (docsRes.data) setDocuments(docsRes.data as PlatformDoc[]);
    };
    load();
  }, []);

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const handleExportMarkdown = () => {
    if (!selectedDocument) return;
    const blob = new Blob([selectedDocument.content || ''], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(selectedDocument.title || 'document').replace(/[^a-z0-9-_]+/gi, '_')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Exported as Markdown');
  };

  const orderedDocs = flattenDocOrder(folders, documents);
  const currentIndex = selectedDocument
    ? orderedDocs.findIndex((d) => d.id === selectedDocument.id)
    : -1;
  const prevDoc = currentIndex > 0 ? orderedDocs[currentIndex - 1] : null;
  const nextDoc =
    currentIndex >= 0 && currentIndex < orderedDocs.length - 1 ? orderedDocs[currentIndex + 1] : null;

  const matches = documents.filter((doc) =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (doc.content && doc.content.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="relative">
              <ChevronLeft className="h-5 w-5" />
              <Kbd className="absolute -bottom-1 -right-1 scale-75">F1</Kbd>
            </Button>
            <h1 className="text-lg font-semibold">Documentation</h1>
          </div>
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
            <div className="flex-1 overflow-y-auto p-2">
              <DocsTree
                folders={folders}
                documents={documents}
                selectedId={selectedDocument?.id}
                expanded={expandedFolders}
                onToggle={toggleFolder}
                onSelect={(doc) => setSelectedDocument(doc)}
              />
              {folders.length === 0 && documents.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No documentation published yet
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          {selectedDocument ? (
            <>
              <div className="border-b p-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold">{selectedDocument.title}</h2>
                <Button variant="outline" size="sm" onClick={handleExportMarkdown} title="Export as Markdown">
                  <Download className="h-4 w-4 mr-1" />
                  Export
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                <article className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{selectedDocument.content}</ReactMarkdown>
                </article>
              </div>
              <div className="border-t p-3 flex items-center justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!prevDoc}
                  onClick={() => prevDoc && setSelectedDocument(prevDoc)}
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
                  onClick={() => nextDoc && setSelectedDocument(nextDoc)}
                >
                  {nextDoc ? nextDoc.title : "Next"}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-6">
              <div className="w-full max-w-md space-y-4">
                <div className="text-center mb-6">
                  <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Search Documentation</p>
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
                    {matches.map((doc) => (
                      <div
                        key={doc.id}
                        onClick={() => { setSelectedDocument(doc); setSearchQuery(""); }}
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
                    {matches.length === 0 && (
                      <p className="p-3 text-sm text-center">No documents found</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Documentation;
