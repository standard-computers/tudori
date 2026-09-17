import { useState, useEffect, useCallback } from 'react';
import { Network, Copy, Trash2, Eye, EyeOff, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';

interface Interconnect {
  id: string;
  company_id: string;
  interconnect_id: string;
  name: string;
  auth_key: string;
  role: string;
  status: string;
  partner_company_id: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
}

interface Props {
  companyId?: string;
  userId?: string;
  dialogOpen: boolean;
  onDialogOpenChange: (open: boolean) => void;
}

const randomToken = (len: number, prefix = '') => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return prefix + Array.from(bytes).map(b => chars[b % chars.length]).join('');
};

export function InterconnectsTab({ companyId, userId, dialogOpen, onDialogOpenChange }: Props) {
  const [rows, setRows] = useState<Interconnect[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<Interconnect | null>(null);
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ interconnect_id: '', name: '', auth_key: '', notes: '' });

  const fetchRows = useCallback(async (cid: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('interconnects')
      .select('*')
      .eq('company_id', cid)
      .order('created_at', { ascending: false });
    if (error) toast.error('Failed to load interconnects');
    else setRows((data as unknown as Interconnect[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (companyId) fetchRows(companyId);
  }, [companyId, fetchRows]);

  useEffect(() => {
    if (dialogOpen) {
      setMode('create');
      setForm({ interconnect_id: randomToken(10, 'IC-'), name: '', auth_key: randomToken(32), notes: '' });
    }
  }, [dialogOpen]);

  const switchMode = (m: 'create' | 'join') => {
    setMode(m);
    setForm(m === 'create'
      ? { interconnect_id: randomToken(10, 'IC-'), name: '', auth_key: randomToken(32), notes: '' }
      : { interconnect_id: '', name: '', auth_key: '', notes: '' });
  };

  const handleSave = async () => {
    if (!companyId) return;
    setSaving(true);
    if (mode === 'create') {
      const { error } = await supabase.from('interconnects').insert({
        company_id: companyId,
        interconnect_id: form.interconnect_id.trim(),
        name: form.name.trim(),
        auth_key: form.auth_key.trim(),
        role: 'owner',
        status: 'pending',
        notes: form.notes || null,
        created_by: userId,
      } as any);
      if (error) {
        toast.error(error.message.includes('duplicate') ? 'That interconnect ID already exists' : 'Failed to create interconnect');
      } else {
        toast.success('Interconnect created — share the ID and auth key with the other organization');
        onDialogOpenChange(false);
        fetchRows(companyId);
      }
    } else {
      const { data, error } = await supabase.rpc('join_interconnect', {
        p_interconnect_id: form.interconnect_id.trim(),
        p_auth_key: form.auth_key.trim(),
        p_name: form.name.trim() || null,
      } as any);
      const result = data as { success?: boolean; error?: string } | null;
      if (error || !result?.success) {
        toast.error(result?.error || 'Failed to connect');
      } else {
        toast.success('Connected to organization');
        onDialogOpenChange(false);
        fetchRows(companyId);
      }
    }
    setSaving(false);
  };

  const toggleActive = async (row: Interconnect) => {
    const { error } = await supabase.from('interconnects').update({ is_active: !row.is_active } as any).eq('id', row.id);
    if (error) toast.error('Failed to update');
    else setRows(prev => prev.map(r => r.id === row.id ? { ...r, is_active: !r.is_active } : r));
  };

  const handleDelete = async () => {
    if (!deleteTarget || !companyId) return;
    const { error } = await supabase.from('interconnects').delete().eq('id', deleteTarget.id);
    if (error) toast.error('Failed to delete');
    else {
      toast.success('Interconnect removed');
      setDeleteTarget(null);
      fetchRows(companyId);
    }
  };

  const toggleReveal = (id: string) => setRevealed(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const copy = (text: string) => { navigator.clipboard.writeText(text); toast.success('Copied to clipboard'); };

  const valid = mode === 'create'
    ? form.interconnect_id.trim() && form.name.trim() && form.auth_key.trim()
    : form.interconnect_id.trim() && form.auth_key.trim();

  return (
    <>
      <div className="rounded-t-md border-t border-x">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>Interconnect ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Auth Key</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No interconnects yet</TableCell></TableRow>
            ) : rows.map(row => (
              <TableRow key={row.id}>
                <TableCell><Network className="w-4 h-4 text-violet-500" /></TableCell>
                <TableCell className="font-mono text-xs">
                  <div className="flex items-center gap-1">
                    <span>{row.interconnect_id}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copy(row.interconnect_id)}>
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell className="font-mono text-xs max-w-48 truncate">
                  <div className="flex items-center gap-1">
                    <span className="truncate">{revealed.has(row.id) ? row.auth_key : '•'.repeat(Math.min(row.auth_key.length, 32))}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleReveal(row.id)}>
                      {revealed.has(row.id) ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copy(row.auth_key)}>
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell><Badge variant="outline" className="capitalize">{row.role}</Badge></TableCell>
                <TableCell>
                  <Badge variant={row.status === 'connected' ? 'default' : 'secondary'} className="capitalize">{row.status}</Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDate(row.created_at)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleActive(row)}>
                      {row.is_active ? <ToggleRight className="w-4 h-4 text-primary" /> : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteTarget(row)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!saving) onDialogOpenChange(o); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Interconnect</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 px-6 py-4">
            <Tabs value={mode} onValueChange={(v) => switchMode(v as 'create' | 'join')}>
              <TabsList className="w-full">
                <TabsTrigger value="create" className="flex-1">Create new</TabsTrigger>
                <TabsTrigger value="join" className="flex-1">Enter existing</TabsTrigger>
              </TabsList>
              <TabsContent value="create" className="mt-3 text-xs text-muted-foreground">
                Generate an interconnect ID and auth key, then share both with the other organization.
              </TabsContent>
              <TabsContent value="join" className="mt-3 text-xs text-muted-foreground">
                Enter the interconnect ID and auth key you received from the other organization.
              </TabsContent>
            </Tabs>

            <div className="space-y-1">
              <Label>Interconnect ID</Label>
              <div className="flex gap-2">
                <Input className="font-mono" value={form.interconnect_id} onChange={e => setForm(f => ({ ...f, interconnect_id: e.target.value }))} placeholder="IC-XXXXXXXXXX" />
                {mode === 'create' && (
                  <Button variant="outline" onClick={() => setForm(f => ({ ...f, interconnect_id: randomToken(10, 'IC-') }))}>Generate</Button>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <Label>Auth Key</Label>
              <div className="flex gap-2">
                <Input className="font-mono" value={form.auth_key} onChange={e => setForm(f => ({ ...f, auth_key: e.target.value }))} placeholder="Auth key" />
                {mode === 'create' && (
                  <Button variant="outline" onClick={() => setForm(f => ({ ...f, auth_key: randomToken(32) }))}>Generate</Button>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <Label>Organization Name{mode === 'join' ? ' (optional)' : ''}</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Acme Distribution" />
            </div>

            {mode === 'create' && (
              <div className="space-y-1">
                <Label>Notes</Label>
                <Textarea placeholder="Optional notes..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleSave} disabled={!valid || saving}>
              {saving ? 'Saving...' : mode === 'create' ? 'Create' : 'Connect'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Remove Interconnect"
        description={`Remove the interconnect "${deleteTarget?.name}"? The other organization will keep their record.`}
      />
    </>
  );
}
