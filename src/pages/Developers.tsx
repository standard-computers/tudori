import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Key, Shield, Webhook, Eye, EyeOff, Copy, Trash2, ToggleLeft, ToggleRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Kbd } from '@/components/ui/kbd';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useStatusMessage } from '@/hooks/use-status-message';
import { useKeyboardShortcut } from '@/hooks/use-keyboard-shortcut';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DeveloperKey {
  id: string;
  company_id: string;
  key_type: string;
  name: string;
  key_value: string | null;
  secret_value: string | null;
  redirect_uri: string | null;
  webhook_url: string | null;
  webhook_events: string[];
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

const WEBHOOK_EVENT_OPTIONS = [
  'order.created', 'order.updated', 'order.deleted',
  'product.created', 'product.updated', 'product.deleted',
  'customer.created', 'customer.updated',
  'inventory.adjusted', 'delivery.shipped', 'invoice.created',
];

export default function Developers() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const statusMessage = useStatusMessage();
  const [keys, setKeys] = useState<DeveloperKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeveloperKey | null>(null);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState('api_key');

  // Form state
  const [form, setForm] = useState({
    key_type: 'api_key',
    name: '',
    key_value: '',
    secret_value: '',
    redirect_uri: '',
    webhook_url: '',
    webhook_events: [] as string[],
    notes: '',
  });

  useKeyboardShortcut('n', () => setDialogOpen(true));
  useKeyboardShortcut('F1', () => navigate(-1));

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (profile?.company_id) {
        setCompanyId(profile.company_id);
        fetchKeys(profile.company_id);
      }
    };
    load();
  }, [user]);

  const fetchKeys = async (cid: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('developer_keys')
      .select('*')
      .eq('company_id', cid)
      .order('created_at', { ascending: false });
    if (error) {
      toast.error('Failed to load developer keys');
    } else {
      setKeys((data as unknown as DeveloperKey[]) || []);
    }
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!companyId || !form.name.trim()) return;
    const { error } = await supabase.from('developer_keys').insert({
      company_id: companyId,
      key_type: form.key_type,
      name: form.name.trim(),
      key_value: form.key_value || null,
      secret_value: form.secret_value || null,
      redirect_uri: form.redirect_uri || null,
      webhook_url: form.webhook_url || null,
      webhook_events: form.webhook_events,
      notes: form.notes || null,
      created_by: user?.id,
    } as any);
    if (error) {
      toast.error('Failed to create key');
    } else {
      toast.success('Key created');
      setDialogOpen(false);
      resetForm();
      fetchKeys(companyId);
    }
  };

  const handleToggleActive = async (key: DeveloperKey) => {
    const { error } = await supabase
      .from('developer_keys')
      .update({ is_active: !key.is_active } as any)
      .eq('id', key.id);
    if (error) {
      toast.error('Failed to update');
    } else {
      setKeys(prev => prev.map(k => k.id === key.id ? { ...k, is_active: !k.is_active } : k));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !companyId) return;
    const { error } = await supabase.from('developer_keys').delete().eq('id', deleteTarget.id);
    if (error) {
      toast.error('Failed to delete');
    } else {
      toast.success('Key deleted');
      setDeleteTarget(null);
      fetchKeys(companyId);
    }
  };

  const toggleReveal = (id: string) => {
    setRevealedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const maskValue = (val: string | null, id: string) => {
    if (!val) return '—';
    if (revealedIds.has(id)) return val;
    return '•'.repeat(Math.min(val.length, 32));
  };

  const resetForm = () => {
    setForm({ key_type: 'api_key', name: '', key_value: '', secret_value: '', redirect_uri: '', webhook_url: '', webhook_events: [], notes: '' });
  };

  const filtered = keys.filter(k => k.key_type === tab);

  useEffect(() => {
    statusMessage.info(`${keys.length} key${keys.length !== 1 ? 's' : ''}`);
  }, [keys.length]);

  const typeIcon = (t: string) => {
    if (t === 'api_key') return <Key className="w-4 h-4 text-amber-500" />;
    if (t === 'oauth') return <Shield className="w-4 h-4 text-blue-500" />;
    return <Webhook className="w-4 h-4 text-emerald-500" />;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-6 h-16 pr-16">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="relative">
            <ArrowLeft className="w-4 h-4" />
            <Kbd className="absolute -bottom-1 -right-1 scale-75">F1</Kbd>
          </Button>
          <h1 className="text-xl font-semibold text-foreground">Developers</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => { setForm(f => ({ ...f, key_type: tab })); setDialogOpen(true); }} size="icon" className="relative">
            <Plus className="w-4 h-4" />
            <Kbd className="absolute -bottom-1 -right-1 scale-75">N</Kbd>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <div className="px-6">
          <TabsList>
            <TabsTrigger value="api_key" className="gap-1.5">
              <Key className="w-3.5 h-3.5" /> API Keys
            </TabsTrigger>
            <TabsTrigger value="oauth" className="gap-1.5">
              <Shield className="w-3.5 h-3.5" /> OAuth
            </TabsTrigger>
            <TabsTrigger value="webhook" className="gap-1.5">
              <Webhook className="w-3.5 h-3.5" /> Webhooks
            </TabsTrigger>
          </TabsList>
        </div>

        {['api_key', 'oauth', 'webhook'].map(type => (
          <TabsContent key={type} value={type} className="mt-0">
            <div className="rounded-t-md border-t border-x mx-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Name</TableHead>
                    {type !== 'webhook' && <TableHead>Key / Client ID</TableHead>}
                    {type !== 'webhook' && <TableHead>Secret</TableHead>}
                    {type === 'oauth' && <TableHead>Redirect URI</TableHead>}
                    {type === 'webhook' && <TableHead>URL</TableHead>}
                    {type === 'webhook' && <TableHead>Events</TableHead>}
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">Loading...</TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No {type === 'api_key' ? 'API keys' : type === 'oauth' ? 'OAuth configs' : 'webhooks'} yet
                      </TableCell>
                    </TableRow>
                  ) : filtered.map(key => (
                    <TableRow key={key.id}>
                      <TableCell>{typeIcon(key.key_type)}</TableCell>
                      <TableCell className="font-medium">{key.name}</TableCell>
                      {type !== 'webhook' && (
                        <TableCell className="font-mono text-xs max-w-48 truncate">
                          <div className="flex items-center gap-1">
                            <span className="truncate">{maskValue(key.key_value, key.id + '-key')}</span>
                            {key.key_value && (
                              <>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleReveal(key.id + '-key')}>
                                  {revealedIds.has(key.id + '-key') ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                </Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(key.key_value!)}>
                                  <Copy className="w-3 h-3" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      )}
                      {type !== 'webhook' && (
                        <TableCell className="font-mono text-xs max-w-48 truncate">
                          <div className="flex items-center gap-1">
                            <span className="truncate">{maskValue(key.secret_value, key.id + '-secret')}</span>
                            {key.secret_value && (
                              <>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleReveal(key.id + '-secret')}>
                                  {revealedIds.has(key.id + '-secret') ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                </Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(key.secret_value!)}>
                                  <Copy className="w-3 h-3" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      )}
                      {type === 'oauth' && (
                        <TableCell className="text-xs max-w-40 truncate">{key.redirect_uri || '—'}</TableCell>
                      )}
                      {type === 'webhook' && (
                        <TableCell className="text-xs max-w-48 truncate font-mono">{key.webhook_url || '—'}</TableCell>
                      )}
                      {type === 'webhook' && (
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(key.webhook_events || []).map(e => (
                              <Badge key={e} variant="secondary" className="text-[10px]">{e}</Badge>
                            ))}
                          </div>
                        </TableCell>
                      )}
                      <TableCell>
                        <Badge variant={key.is_active ? 'default' : 'secondary'}>
                          {key.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleToggleActive(key)}>
                            {key.is_active ? <ToggleRight className="w-4 h-4 text-primary" /> : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteTarget(key)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New {form.key_type === 'api_key' ? 'API Key' : form.key_type === 'oauth' ? 'OAuth Config' : 'Webhook'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 px-6 py-4">
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={form.key_type} onValueChange={v => setForm(f => ({ ...f, key_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="api_key">API Key</SelectItem>
                  <SelectItem value="oauth">OAuth</SelectItem>
                  <SelectItem value="webhook">Webhook</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Name</Label>
              <Input placeholder="e.g. Production API Key" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            {form.key_type !== 'webhook' && (
              <>
                <div className="space-y-1">
                  <Label>{form.key_type === 'oauth' ? 'Client ID' : 'API Key'}</Label>
                  <Input placeholder="Enter key value" value={form.key_value} onChange={e => setForm(f => ({ ...f, key_value: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>{form.key_type === 'oauth' ? 'Client Secret' : 'Secret Key'}</Label>
                  <Input type="password" placeholder="Enter secret" value={form.secret_value} onChange={e => setForm(f => ({ ...f, secret_value: e.target.value }))} />
                </div>
              </>
            )}
            {form.key_type === 'oauth' && (
              <div className="space-y-1">
                <Label>Redirect URI</Label>
                <Input placeholder="https://..." value={form.redirect_uri} onChange={e => setForm(f => ({ ...f, redirect_uri: e.target.value }))} />
              </div>
            )}
            {form.key_type === 'webhook' && (
              <>
                <div className="space-y-1">
                  <Label>Webhook URL</Label>
                  <Input placeholder="https://..." value={form.webhook_url} onChange={e => setForm(f => ({ ...f, webhook_url: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Events</Label>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {WEBHOOK_EVENT_OPTIONS.map(evt => (
                      <Badge
                        key={evt}
                        variant={form.webhook_events.includes(evt) ? 'default' : 'outline'}
                        className="cursor-pointer text-xs"
                        onClick={() => setForm(f => ({
                          ...f,
                          webhook_events: f.webhook_events.includes(evt)
                            ? f.webhook_events.filter(e => e !== evt)
                            : [...f.webhook_events, evt]
                        }))}
                      >
                        {evt}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea placeholder="Optional notes..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!form.name.trim()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Key"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
      />
    </div>
  );
}
