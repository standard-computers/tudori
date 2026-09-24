import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Pencil, Trash2, RotateCcw } from 'lucide-react';
import { LAYOUT_REGISTRY, LayoutRegistryEntry } from '@/config/column-layouts';
import type { ColumnVisibilityState } from '@/hooks/use-column-visibility';
import { toast } from 'sonner';

const PREFIX = 'column_visibility_';

const defaultsFor = (e: LayoutRegistryEntry): ColumnVisibilityState =>
  Object.fromEntries(e.columns.map((c) => [c.key, c.defaultVisible !== false]));

const readLayout = (e: LayoutRegistryEntry): ColumnVisibilityState | null => {
  const raw = localStorage.getItem(PREFIX + e.storageKey);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
};

export function LayoutsTab() {
  const [layouts, setLayouts] = useState<Record<string, ColumnVisibilityState | null>>({});
  const [editing, setEditing] = useState<LayoutRegistryEntry | null>(null);
  const [draft, setDraft] = useState<ColumnVisibilityState>({});
  const [deleting, setDeleting] = useState<LayoutRegistryEntry | null>(null);

  const refresh = () =>
    setLayouts(Object.fromEntries(LAYOUT_REGISTRY.map((e) => [e.storageKey, readLayout(e)])));
  useEffect(refresh, []);

  const openEdit = (e: LayoutRegistryEntry) => {
    setDraft({ ...defaultsFor(e), ...(layouts[e.storageKey] || {}) });
    setEditing(e);
  };

  const save = () => {
    if (!editing) return;
    localStorage.setItem(PREFIX + editing.storageKey, JSON.stringify(draft));
    toast.success(`${editing.label} layout saved`);
    setEditing(null);
    refresh();
  };

  const remove = () => {
    if (!deleting) return;
    localStorage.removeItem(PREFIX + deleting.storageKey);
    toast.success(`${deleting.label} layout reset to defaults`);
    setDeleting(null);
    refresh();
  };

  const visibleCount = (e: LayoutRegistryEntry) => {
    const state = { ...defaultsFor(e), ...(layouts[e.storageKey] || {}) };
    return e.columns.filter((c) => c.alwaysVisible || state[c.key] !== false).length;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Layouts</CardTitle>
        <CardDescription>Column layouts saved for each app. Edit which columns show, or delete a layout to return to defaults.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {LAYOUT_REGISTRY.map((e) => {
          const custom = !!layouts[e.storageKey];
          return (
            <div key={e.storageKey} className="flex items-center justify-between gap-3 rounded-md border p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{e.label}</span>
                  <Badge variant={custom ? 'default' : 'secondary'}>{custom ? 'Custom' : 'Default'}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {visibleCount(e)} of {e.columns.length} columns visible
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" title="Edit layout" onClick={() => openEdit(e)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" title="Delete layout" disabled={!custom} onClick={() => setDeleting(e)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.label} Layout</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="flex gap-2 mb-3">
              <Button variant="outline" size="sm" onClick={() => editing && setDraft(Object.fromEntries(editing.columns.map((c) => [c.key, true])))}>Show All</Button>
              <Button variant="outline" size="sm" onClick={() => editing && setDraft(Object.fromEntries(editing.columns.map((c) => [c.key, !!c.alwaysVisible])))}>Hide All</Button>
              <Button variant="outline" size="sm" onClick={() => editing && setDraft(defaultsFor(editing))}>
                <RotateCcw className="w-3 h-3 mr-1" /> Defaults
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {editing?.columns.map((c) => (
                <label key={c.key} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={c.alwaysVisible || draft[c.key] !== false}
                    disabled={c.alwaysVisible}
                    onCheckedChange={(v) => setDraft((d) => ({ ...d, [c.key]: !!v }))}
                  />
                  {c.label}{c.alwaysVisible && <span className="text-xs text-muted-foreground">(always)</span>}
                </label>
              ))}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.label} layout?</AlertDialogTitle>
            <AlertDialogDescription>The app will go back to its default columns.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
