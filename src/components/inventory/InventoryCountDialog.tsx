import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/lib/toast';
import { ArrowLeft, Plus, Eye, ClipboardCheck, CheckCircle2, Trash2 } from 'lucide-react';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { AreaBinSelector } from '@/components/inventory/AreaBinSelector';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { format, parseISO } from 'date-fns';

interface InventoryCountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string | null;
  locationId: string;
  locationName: string;
  inventory: Array<{
    id: string;
    quantity: number;
    product: {
      id: string;
      product_id: string;
      name: string;
    } | null;
    bin: {
      id: string;
      name: string;
    } | null;
  }>;
}

interface CountSession {
  id: string;
  count_number: string;
  status: string;
  count_date: string;
  notes: string | null;
  created_at: string;
  location: { name: string } | null;
}

interface CountItem {
  id: string;
  product_id: string;
  bin_id: string | null;
  system_quantity: number;
  counted_quantity: number | null;
  variance: number | null;
  notes: string | null;
  product: { product_id: string; name: string; price: number | null } | null;
  bin: { name: string } | null;
}

type View = 'list' | 'select_scope' | 'detail';

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  posted: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
};

export const InventoryCountDialog = ({
  open,
  onOpenChange,
  companyId,
  locationId,
  locationName,
  inventory,
}: InventoryCountDialogProps) => {
  const { user } = useAuth();
  const [view, setView] = useState<View>('list');
  const [counts, setCounts] = useState<CountSession[]>([]);
  const [selectedCount, setSelectedCount] = useState<CountSession | null>(null);
  const [countItems, setCountItems] = useState<CountItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CountSession | null>(null);
  const [selectedBinIds, setSelectedBinIds] = useState<Set<string>>(new Set());
  const [includeUnbinned, setIncludeUnbinned] = useState(true);
  const [explode, setExplode] = useState(false);
  const [explodeBy, setExplodeBy] = useState<'area' | 'bin'>('area');
  const fetchCounts = useCallback(async () => {
    if (!companyId || !locationId) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from('inventory_counts')
      .select('id, count_number, status, count_date, notes, created_at, location:locations(name)')
      .eq('company_id', companyId)
      .eq('location_id', locationId)
      .order('created_at', { ascending: false });

    setIsLoading(false);
    if (error) {
      toast.error('Failed to load count sheets');
      return;
    }
    setCounts((data as unknown as CountSession[]) || []);
  }, [companyId, locationId]);

  useEffect(() => {
    if (open && view === 'list') {
      fetchCounts();
    }
  }, [open, view, fetchCounts]);

  const fetchCountItems = async (countId: string) => {
    const { data, error } = await supabase
      .from('inventory_count_items')
      .select('id, product_id, bin_id, system_quantity, counted_quantity, variance, notes, product:products(product_id, name, price), bin:bins(name)')
      .eq('count_id', countId)
      .order('created_at');

    if (error) {
      toast.error('Failed to load count items');
      return;
    }
    setCountItems((data as unknown as CountItem[]) || []);
  };

  const handleCreateCount = () => {
    if (!locationId) {
      toast.error('No location selected');
      return;
    }
    setSelectedBinIds(new Set());
    setIncludeUnbinned(true);
    setExplode(false);
    setExplodeBy('area');
    setView('select_scope');
  };

  const createSingleCountSheet = async (
    filteredInventory: typeof inventory,
    noteSuffix?: string,
  ): Promise<{ id: string; count_number: string } | null> => {
    const { data: countNumber, error: numError } = await supabase
      .rpc('get_next_count_number', { p_company_id: companyId! });
    if (numError) {
      toast.error('Failed to generate count number');
      return null;
    }
    const { data: newCount, error: createError } = await supabase
      .from('inventory_counts')
      .insert({
        count_number: countNumber,
        company_id: companyId!,
        location_id: locationId,
        status: 'in_progress',
        created_by: user?.id,
        notes: noteSuffix || null,
      })
      .select('id, count_number, status, count_date, notes, created_at')
      .single();
    if (createError || !newCount) {
      toast.error('Failed to create count sheet');
      return null;
    }
    const items = filteredInventory.map((inv) => ({
      count_id: newCount.id,
      product_id: inv.product?.id || '',
      bin_id: inv.bin?.id || null,
      system_quantity: inv.quantity,
    }));
    if (items.length > 0) {
      const { error: itemsError } = await supabase
        .from('inventory_count_items')
        .insert(items);
      if (itemsError) {
        toast.error('Failed to create count items');
        return null;
      }
    }
    return { id: newCount.id, count_number: newCount.count_number };
  };


  const handleConfirmCreate = async () => {
    if (!companyId || !locationId) return;

    // Filter inventory based on selected bins + unbinned
    const filteredInventory = inventory.filter((inv) => {
      if (!inv.bin?.id) return includeUnbinned;
      return selectedBinIds.has(inv.bin.id);
    });

    if (filteredInventory.length === 0) {
      toast.error('No inventory items match the selected areas/bins');
      return;
    }

    setIsSaving(true);

    // Non-exploded: single sheet
    if (!explode) {
      const result = await createSingleCountSheet(filteredInventory);
      setIsSaving(false);
      if (!result) return;
      toast.success(`Count sheet ${result.count_number} created with ${filteredInventory.length} item(s)`);
      setSelectedCount({
        id: result.id,
        count_number: result.count_number,
        status: 'in_progress',
        count_date: new Date().toISOString().slice(0, 10),
        notes: null,
        created_at: new Date().toISOString(),
        location: { name: locationName },
      });
      await fetchCountItems(result.id);
      setView('detail');
      return;
    }

    // Explode: group filtered inventory
    const groups = new Map<string, { label: string; items: typeof inventory }>();

    if (explodeBy === 'bin') {
      for (const inv of filteredInventory) {
        const key = inv.bin?.id || '__unbinned__';
        const label = inv.bin?.name || 'Unbinned';
        if (!groups.has(key)) groups.set(key, { label, items: [] });
        groups.get(key)!.items.push(inv);
      }
    } else {
      // by area — need bin -> area mapping
      const binIds = Array.from(
        new Set(filteredInventory.map((inv) => inv.bin?.id).filter(Boolean) as string[]),
      );
      let binAreaMap = new Map<string, { area_id: string; area_name: string }>();
      if (binIds.length > 0) {
        const { data: binRows } = await supabase
          .from('bins')
          .select('id, area_id, area:areas(id, name)')
          .in('id', binIds);
        for (const b of (binRows || []) as any[]) {
          binAreaMap.set(b.id, {
            area_id: b.area_id,
            area_name: b.area?.name || 'Unknown Area',
          });
        }
      }
      for (const inv of filteredInventory) {
        if (!inv.bin?.id) {
          const key = '__unbinned__';
          if (!groups.has(key)) groups.set(key, { label: 'Unbinned', items: [] });
          groups.get(key)!.items.push(inv);
          continue;
        }
        const info = binAreaMap.get(inv.bin.id);
        const key = info?.area_id || '__unknown__';
        const label = info?.area_name || 'Unknown Area';
        if (!groups.has(key)) groups.set(key, { label, items: [] });
        groups.get(key)!.items.push(inv);
      }
    }

    const created: string[] = [];
    for (const [, group] of groups) {
      const result = await createSingleCountSheet(
        group.items,
        `${explodeBy === 'area' ? 'Area' : 'Bin'}: ${group.label}`,
      );
      if (result) created.push(result.count_number);
    }

    setIsSaving(false);
    if (created.length === 0) return;
    toast.success(`Created ${created.length} count sheet${created.length === 1 ? '' : 's'}`);
    setView('list');
    fetchCounts();
  };


  const handleViewCount = async (count: CountSession) => {
    setSelectedCount(count);
    await fetchCountItems(count.id);
    setView('detail');
  };

  const handleUpdateQuantity = (itemId: string, value: string) => {
    const numValue = value === '' ? null : parseFloat(value);
    setCountItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, counted_quantity: numValue, variance: numValue !== null ? numValue - item.system_quantity : null }
          : item
      )
    );
  };

  const handleSaveItems = async () => {
    setIsSaving(true);
    const updates = countItems.map((item) =>
      supabase
        .from('inventory_count_items')
        .update({ counted_quantity: item.counted_quantity })
        .eq('id', item.id)
    );

    const results = await Promise.all(updates);
    const failed = results.filter((r) => r.error);
    setIsSaving(false);

    if (failed.length > 0) {
      toast.error('Some items failed to save');
      return;
    }
    toast.success('Count saved');
  };

  const handleCompleteCount = async () => {
    if (!selectedCount) return;
    // Check all items have been counted
    const uncounted = countItems.filter((i) => i.counted_quantity === null);
    if (uncounted.length > 0) {
      toast.error(`${uncounted.length} item(s) still need to be counted`);
      return;
    }

    setIsSaving(true);
    // Save items first
    await handleSaveItems();

    const { error } = await supabase
      .from('inventory_counts')
      .update({ status: 'completed' })
      .eq('id', selectedCount.id);

    setIsSaving(false);
    if (error) {
      toast.error('Failed to complete count');
      return;
    }

    toast.success('Count completed');
    setSelectedCount({ ...selectedCount, status: 'completed' });
  };

  const handlePostAdjustments = async () => {
    if (!selectedCount || !companyId) return;
    setIsSaving(true);

    // Separate items with variance into gains (positive) and losses (negative)
    const gains: CountItem[] = [];
    const losses: CountItem[] = [];
    let netValuationChange = 0;

    for (const item of countItems) {
      if (item.variance && item.variance !== 0) {
        const price = item.product?.price || 0;
        if (item.variance > 0) {
          gains.push(item);
          netValuationChange += item.variance * price;
        } else {
          losses.push(item);
          netValuationChange += item.variance * price; // negative
        }
      }
    }

    try {
      // Create Goods Receipt for gains (positive variances)
      if (gains.length > 0) {
        const { data: grNumber } = await supabase.rpc('get_next_goods_receipt_number', { p_company_id: companyId });

        const { data: gr, error: grError } = await supabase
          .from('goods_receipts' as any)
          .insert({
            company_id: companyId,
            location_id: locationId,
            receipt_number: grNumber,
            receipt_date: new Date().toISOString().split('T')[0],
            status: 'posted',
            notes: `Physical inventory adjustment – Count ${selectedCount.count_number}`,
          })
          .select('id')
          .single();

        if (grError) throw grError;

        const grItems = gains.map((item) => ({
          goods_receipt_id: (gr as any).id,
          product_id: item.product_id,
          quantity: item.variance!,
          bin_id: item.bin_id || null,
          notes: `Count adjustment +${item.variance}`,
        }));

        const { error: grItemsError } = await supabase
          .from('goods_receipt_items' as any)
          .insert(grItems);
        if (grItemsError) throw grItemsError;
      }

      // Create Goods Issue for losses (negative variances)
      if (losses.length > 0) {
        const { data: giNumber } = await supabase.rpc('get_next_goods_issue_number', { p_company_id: companyId });

        const { data: gi, error: giError } = await supabase
          .from('goods_issues' as any)
          .insert({
            company_id: companyId,
            location_id: locationId,
            issue_number: giNumber,
            issue_date: new Date().toISOString().split('T')[0],
            status: 'posted',
            notes: `Physical inventory adjustment – Count ${selectedCount.count_number}`,
          })
          .select('id')
          .single();

        if (giError) throw giError;

        const giItems = losses.map((item) => ({
          goods_issue_id: (gi as any).id,
          product_id: item.product_id,
          quantity: Math.abs(item.variance!),
          bin_id: item.bin_id || null,
          notes: `Count adjustment ${item.variance}`,
        }));

        const { error: giItemsError } = await supabase
          .from('goods_issue_items' as any)
          .insert(giItems);
        if (giItemsError) throw giItemsError;
      }

      // Create a single ledger adjustment for the net valuation change
      if (netValuationChange !== 0) {
        const { getInventoryLedgerId } = await import('@/lib/inventory-account');
        const ledgerId = await getInventoryLedgerId(locationId, companyId);

        if (ledgerId) {
          await supabase.from('ledger_transactions' as any).insert({
            ledger_id: ledgerId,
            transaction_type: 'inventory_adjustment',
            reference_id: selectedCount.id,
            reference_number: selectedCount.count_number,
            amount: netValuationChange,
            description: `Inventory count adjustment – ${selectedCount.count_number}${netValuationChange > 0 ? ' (net gain)' : ' (net loss)'}`,
            transaction_date: new Date().toISOString().split('T')[0],
          });
        }
      }

      // Apply variance adjustments to inventory
      for (const item of countItems) {
        if (item.variance && item.variance !== 0) {
          const { error } = await supabase
            .from('inventory')
            .update({ quantity: item.counted_quantity!, last_counted_at: new Date().toISOString() })
            .eq('location_id', locationId)
            .eq('product_id', item.product_id)
            .eq(item.bin_id ? 'bin_id' : 'id', item.bin_id || '');

          if (error && item.bin_id) {
            await supabase
              .from('inventory')
              .update({ quantity: item.counted_quantity!, last_counted_at: new Date().toISOString() })
              .eq('location_id', locationId)
              .eq('product_id', item.product_id)
              .eq('bin_id', item.bin_id);
          }
        } else {
          await supabase
            .from('inventory')
            .update({ last_counted_at: new Date().toISOString() })
            .eq('location_id', locationId)
            .eq('product_id', item.product_id);
        }
      }

      // Mark count as posted
      const { error } = await supabase
        .from('inventory_counts')
        .update({ status: 'posted' })
        .eq('id', selectedCount.id);

      setIsSaving(false);
      if (error) {
        toast.error('Failed to post adjustments');
        return;
      }

      toast.success('Inventory adjustments posted');
      setSelectedCount({ ...selectedCount, status: 'posted' });
    } catch (err: any) {
      console.error('Failed to post inventory adjustments:', err);
      setIsSaving(false);
      toast.error(err.message || 'Failed to post adjustments');
    }
  };

  const handleDeleteCount = async () => {
    if (!deleteTarget) return;
    setIsSaving(true);
    const { error } = await supabase
      .from('inventory_counts')
      .delete()
      .eq('id', deleteTarget.id);
    setIsSaving(false);
    setDeleteTarget(null);
    if (error) {
      toast.error('Failed to delete count sheet');
      return;
    }
    toast.success(`Count sheet ${deleteTarget.count_number} deleted`);
    fetchCounts();
  };

  const handleBack = () => {
    if (view === 'detail') {
      setView('list');
      setSelectedCount(null);
      setCountItems([]);
      fetchCounts();
    } else if (view === 'select_scope') {
      setView('list');
    }
  };

  const isEditable = selectedCount?.status === 'in_progress' || selectedCount?.status === 'draft';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {(view === 'detail' || view === 'select_scope') && (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <DialogTitle>
              {view === 'list'
                ? 'Physical Inventory Count Sheets'
                : view === 'select_scope'
                ? 'Select Areas & Bins to Count'
                : `Count Sheet ${selectedCount?.count_number || ''}`}
            </DialogTitle>
          </div>
          <DialogDescription>
            {view === 'list'
              ? `Count sheets for ${locationName}`
              : view === 'select_scope'
              ? `Choose which areas and bins to include in the count for ${locationName}`
              : `Status: ${selectedCount?.status || ''} • ${selectedCount?.count_date ? format(parseISO(selectedCount.count_date), 'MMM d, yyyy') : ''}`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-2">
          {view === 'list' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1 py-3">
                <span className="text-sm text-muted-foreground">
                  {counts.length} count sheet{counts.length !== 1 ? 's' : ''}
                </span>
                <Button size="sm" onClick={handleCreateCount} disabled={isSaving || !locationId}>
                  <Plus className="h-4 w-4 mr-1" />
                  New Count
                </Button>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                </div>
              ) : counts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No count sheets yet. Create one to start counting.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-28">Count #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="w-16" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {counts.map((count) => (
                      <TableRow key={count.id}>
                        <TableCell className="font-mono text-sm">{count.count_number}</TableCell>
                        <TableCell>{format(parseISO(count.count_date), 'MMM d, yyyy')}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={statusColors[count.status] || ''}>
                            {count.status.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground truncate max-w-[200px]">
                          {count.notes || '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 justify-end">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleViewCount(count)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            {(count.status === 'in_progress' || count.status === 'draft') && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => setDeleteTarget(count)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          ) : view === 'select_scope' ? (
            <div className="space-y-4">
              <AreaBinSelector
                locationId={locationId}
                selectedBinIds={selectedBinIds}
                onSelectionChange={setSelectedBinIds}
                includeUnbinned={includeUnbinned}
                onIncludeUnbinnedChange={setIncludeUnbinned}
              />

              <div className="rounded-md border p-3 space-y-3">
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="explode-count"
                    checked={explode}
                    onCheckedChange={(v) => setExplode(v === true)}
                  />
                  <div className="grid gap-1 leading-none">
                    <Label htmlFor="explode-count" className="cursor-pointer">
                      Explode into multiple count sheets
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Create a separate count sheet per group instead of one combined sheet.
                    </p>
                  </div>
                </div>

                {explode && (
                  <div className="pl-6">
                    <Label className="text-xs text-muted-foreground">Explode by</Label>
                    <RadioGroup
                      value={explodeBy}
                      onValueChange={(v) => setExplodeBy(v as 'area' | 'bin')}
                      className="flex gap-4 mt-1"
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="area" id="explode-by-area" />
                        <Label htmlFor="explode-by-area" className="cursor-pointer font-normal">
                          Area (one sheet per area)
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="bin" id="explode-by-bin" />
                        <Label htmlFor="explode-by-bin" className="cursor-pointer font-normal">
                          Bin (one sheet per bin)
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                )}
              </div>
            </div>

          ) : (
            <div className="space-y-4">
              {/* Variance summary */}
              {countItems.length > 0 && (
                <div className="flex items-center gap-6 text-sm text-muted-foreground pb-2 border-b">
                  <span>
                    <strong className="text-foreground">{countItems.length}</strong> items
                  </span>
                  <span>
                    <strong className="text-foreground">
                      {countItems.filter((i) => i.counted_quantity !== null).length}
                    </strong>{' '}
                    counted
                  </span>
                  <span>
                    <strong className="text-foreground">
                      {countItems.filter((i) => i.variance !== null && i.variance !== 0).length}
                    </strong>{' '}
                    with variance
                  </span>
                </div>
              )}

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Product ID</TableHead>
                    <TableHead>Product Name</TableHead>
                    <TableHead>Bin</TableHead>
                    <TableHead className="text-right w-24">System Qty</TableHead>
                    <TableHead className="text-right w-28">Counted Qty</TableHead>
                    <TableHead className="text-right w-24">Variance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {countItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-sm">{item.product?.product_id || '-'}</TableCell>
                      <TableCell>{item.product?.name || '-'}</TableCell>
                      <TableCell>{item.bin?.name || '-'}</TableCell>
                      <TableCell className="text-right">{item.system_quantity}</TableCell>
                      <TableCell className="text-right">
                        {isEditable ? (
                          <Input
                            type="number"
                            className="h-8 w-24 text-right ml-auto"
                            value={item.counted_quantity ?? ''}
                            onChange={(e) => handleUpdateQuantity(item.id, e.target.value)}
                            placeholder="—"
                          />
                        ) : (
                          <span>{item.counted_quantity ?? '—'}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.counted_quantity !== null ? (
                          <span
                            className={
                              (item.variance ?? 0) < 0
                                ? 'text-destructive font-medium'
                                : (item.variance ?? 0) > 0
                                ? 'text-green-600 font-medium'
                                : 'text-muted-foreground'
                            }
                          >
                            {(item.variance ?? 0) > 0 ? '+' : ''}
                            {item.variance}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Footer actions for scope selection */}
        {view === 'select_scope' && (
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t">
            <Button variant="outline" size="sm" onClick={handleBack}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleConfirmCreate} disabled={isSaving || (selectedBinIds.size === 0 && !includeUnbinned)}>
              <Plus className="h-4 w-4 mr-1" />
              {isSaving ? 'Creating...' : explode ? 'Create Count Sheets' : 'Create Count Sheet'}
            </Button>
          </div>
        )}

        {/* Footer actions for detail view */}
        {view === 'detail' && selectedCount && (
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t">
            {isEditable && (
              <>
                <Button variant="outline" size="sm" onClick={handleSaveItems} disabled={isSaving}>
                  Save
                </Button>
                <Button size="sm" onClick={handleCompleteCount} disabled={isSaving}>
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Complete Count
                </Button>
              </>
            )}
            {selectedCount.status === 'completed' && (
              <Button size="sm" onClick={handlePostAdjustments} disabled={isSaving}>
                <ClipboardCheck className="h-4 w-4 mr-1" />
                Post Adjustments
              </Button>
            )}
          </div>
        )}
      </DialogContent>

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Count Sheet"
        description={`Are you sure you want to delete count sheet ${deleteTarget?.count_number || ''}? This action cannot be undone.`}
        onConfirm={handleDeleteCount}
      />
    </Dialog>
  );
};
