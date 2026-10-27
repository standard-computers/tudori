import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SearchableSelect } from '@/components/SearchableSelect';
import { ReceiveDeliveryDialog } from '@/components/ReceiveDeliveryDialog';
import { logMaterialMovement } from '@/lib/material-movements';
import { toast } from '@/lib/toast';
import { Boxes, PackageCheck, ArrowDownToLine, Loader2, ChevronRight, PackageSearch } from 'lucide-react';

interface Props {
  locationId: string;
  companyId: string;
  onDone: () => void;
}

interface DeliveryRow { id: string; delivery_id: string; purchase_order_id: string | null; status: string | null; expected_date: string | null }
interface StockRow { pu_number?: string | null; id: string; product_id: string; quantity: number; bin_id: string; pu_id: string | null; uom_id: string | null; batch_id: string | null; product?: { name: string; product_id: string }; bin?: { bin_id: string; name: string } }

export function GoInboundActions({ locationId, companyId, onDone }: Props) {
  const [mode, setMode] = useState<'receive' | 'receivePu' | 'putawayPu' | 'putaway' | null>(null);
  const [loading, setLoading] = useState(false);
  const [receiving, setReceiving] = useState<DeliveryRow | null>(null);
  const [receivePuId, setReceivePuId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [stock, setStock] = useState<StockRow[]>([]);
  const [bins, setBins] = useState<{ value: string; label: string; sublabel?: string }[]>([]);
  const [selected, setSelected] = useState<StockRow | null>(null);
  const [qty, setQty] = useState('');
  const [destBin, setDestBin] = useState('');
  const [saving, setSaving] = useState(false);
  const [puCode, setPuCode] = useState('');
  const [puRows, setPuRows] = useState<StockRow[] | null>(null);

  const openReceive = (m: 'receive' | 'receivePu') => { setMode(m); setCode(''); };

  const lookup = async () => {
    const value = code.trim();
    if (!value) return;
    setLoading(true);
    try {
      if (mode === 'receive') {
        const { data } = await supabase.from('deliveries')
          .select('id, delivery_id, purchase_order_id, status, expected_date')
          .eq('location_id', locationId).ilike('delivery_id', value).limit(1).maybeSingle();
        if (!data) { toast.error(`Delivery ${value} not found at this location`); return; }
        if (['delivered', 'canceled', 'cancelled'].includes((data as any).status)) { toast.error(`Delivery ${value} is already ${(data as any).status}`); return; }
        setReceivePuId(null);
        setReceiving(data as DeliveryRow);
      } else {
        const { data: pu } = await supabase.from('packaging_units' as any)
          .select('id, pu_number').eq('company_id', companyId).ilike('pu_number', value).limit(1).maybeSingle();
        if (!pu) { toast.error(`PU ${value} not found`); return; }
        const { data: item } = await supabase.from('delivery_items')
          .select('delivery:deliveries!inner(id, delivery_id, purchase_order_id, status, expected_date, location_id)')
          .eq('pu_id', (pu as any).id).eq('delivery.location_id', locationId)
          .not('delivery.status', 'in', '("delivered","canceled","cancelled")').limit(1).maybeSingle();
        const d = (item as any)?.delivery;
        if (!d) { toast.error(`No open inbound delivery at this location contains PU ${value}`); return; }
        setReceivePuId((pu as any).id);
        setReceiving(d as DeliveryRow);
      }
    } finally { setLoading(false); }
  };

  const openPutAway = async () => {
    setMode('putaway');
    setSelected(null);
    await loadStock();
  };

  const openPutAwayPu = () => { setMode('putawayPu'); setPuCode(''); setPuRows(null); setDestBin(''); };

  const loadStock = async (): Promise<StockRow[]> => {
    setLoading(true);
    let rows: StockRow[] = [];
    const { data: areas } = await supabase
      .from('areas')
      .select('id, is_goods_receipt_enabled, bins(id, bin_id, name, allow_put_away)')
      .eq('location_id', locationId);
    const grBinIds: string[] = [];
    const dest: { value: string; label: string; sublabel?: string }[] = [];
    (areas || []).forEach((a: any) => {
      (a.bins || []).forEach((b: any) => {
        if (a.is_goods_receipt_enabled) grBinIds.push(b.id);
        else if (b.allow_put_away !== false) dest.push({ value: b.id, label: b.name, sublabel: b.bin_id });
      });
    });
    setBins(dest);
    if (grBinIds.length) {
      const { data } = await supabase
        .from('inventory')
        .select('id, product_id, quantity, bin_id, pu_id, uom_id, batch_id, product:products(name, product_id), bin:bins(bin_id, name)')
        .eq('location_id', locationId)
        .in('bin_id', grBinIds)
        .gt('quantity', 0);
      rows = (data || []) as any;
      const puIds = [...new Set(rows.map((r) => r.pu_id).filter(Boolean))] as string[];
      if (puIds.length) {
        const { data: pus } = await supabase.from('packaging_units' as any).select('id, pu_number').in('id', puIds);
        const m = new Map((pus || []).map((p: any) => [p.id, p.pu_number]));
        rows = rows.map((r) => ({ ...r, pu_number: r.pu_id ? m.get(r.pu_id) ?? null : null }));
      }
    }
    setStock(rows);
    setLoading(false);
    return rows;
  };

  const lookupPu = async () => {
    const value = puCode.trim();
    if (!value) return;
    const rows = await loadStock();
    const match = rows.filter((r) => (r.pu_number || '').toLowerCase() === value.toLowerCase());
    if (!match.length) { toast.error(`PU ${value} has no stock waiting for put away here`); setPuRows(null); return; }
    setPuRows(match);
  };

  const doPutAwayPu = async () => {
    if (!puRows?.length || !destBin) return;
    setSaving(true);
    try {
      for (const r of puRows) await moveRow(r, r.quantity, destBin);
      toast.success(`PU ${puCode.trim()} put away`);
      setPuRows(null); setPuCode(''); setDestBin('');
      onDone();
    } catch (e: any) {
      toast.error(e?.message || 'Put away failed');
    } finally { setSaving(false); }
  };

  const doPutAway = async () => {
    if (!selected || !destBin) return;
    const q = Number(qty);
    if (!(q > 0) || q > selected.quantity) { toast.error(`Enter a quantity between 0 and ${selected.quantity}`); return; }
    setSaving(true);
    try {
      await moveRow(selected, q, destBin);
      toast.success('Put away complete');
      setSelected(null);
      await openPutAway();
      onDone();
    } catch (e: any) {
      toast.error(e?.message || 'Put away failed');
    } finally {
      setSaving(false);
    }
  };

  const moveRow = async (selected: StockRow, q: number, destBin: string) => {
    {
      const remaining = selected.quantity - q;
      const src = remaining === 0
        ? await supabase.from('inventory').delete().eq('id', selected.id)
        : await supabase.from('inventory').update({ quantity: remaining, updated_at: new Date().toISOString() }).eq('id', selected.id);
      if (src.error) throw src.error;

      let query = supabase.from('inventory').select('id, quantity').eq('location_id', locationId).eq('product_id', selected.product_id).eq('bin_id', destBin);
      query = selected.pu_id ? query.eq('pu_id', selected.pu_id) : query.is('pu_id', null);
      query = selected.uom_id ? query.eq('uom_id', selected.uom_id) : query.is('uom_id', null);
      query = selected.batch_id ? query.eq('batch_id', selected.batch_id) : query.is('batch_id', null);
      const { data: existing } = await query.limit(1).maybeSingle();
      const dst = existing
        ? await supabase.from('inventory').update({ quantity: existing.quantity + q, updated_at: new Date().toISOString() }).eq('id', existing.id)
        : await supabase.from('inventory').insert({ location_id: locationId, product_id: selected.product_id, bin_id: destBin, quantity: q, pu_id: selected.pu_id, uom_id: selected.uom_id, batch_id: selected.batch_id } as any);
      if (dst.error) throw dst.error;

      await logMaterialMovement({
        companyId, locationId, productId: selected.product_id, quantity: q, movementType: 'transfer',
        puId: selected.pu_id, sourceBinId: selected.bin_id, destinationBinId: destBin,
        referenceType: 'inventory_transfer', notes: 'Put away (Go)',
      });
    }
  };

  const Card = ({ icon: Icon, label, desc, onClick }: any) => (
    <button onClick={onClick} className="w-full flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary/20 active:scale-[0.98] text-left transition-all">
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><Icon className="w-5 h-5 text-primary" /></div>
      <div className="flex-1 min-w-0"><div className="font-semibold text-sm">{label}</div><div className="text-xs text-muted-foreground">{desc}</div></div>
      <ChevronRight className="w-4 h-4 text-muted-foreground" />
    </button>
  );

  return (
    <>
      <div className="grid grid-cols-1 gap-2">
        <Card icon={PackageCheck} label="Receive Delivery" desc="Enter a delivery number to receive" onClick={() => openReceive('receive')} />
        <Card icon={Boxes} label="Receive PU" desc="Enter a PU number to receive" onClick={() => openReceive('receivePu')} />
        <Card icon={PackageSearch} label="Put Away by PU" desc="Enter a PU number and move it to a bin" onClick={openPutAwayPu} />
        <Card icon={ArrowDownToLine} label="View Putaway" desc="All stock waiting in goods receipt areas" onClick={openPutAway} />
      </div>

      <Dialog open={mode !== null && !receiving} onOpenChange={(o) => { if (!o && !saving) setMode(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{mode === 'receive' ? 'Receive Delivery' : mode === 'receivePu' ? 'Receive PU' : mode === 'putawayPu' ? 'Put Away by PU' : 'View Putaway'}</DialogTitle></DialogHeader>
          <div className="space-y-2 px-1 pb-2 max-h-[60vh] overflow-y-auto">
            {mode === 'receive' || mode === 'receivePu' ? (
              <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); lookup(); }}>
                <Input autoFocus value={code} onChange={(e) => setCode(e.target.value)} placeholder={mode === 'receive' ? 'Delivery number' : 'PU number'} />
                <Button type="submit" className="w-full" disabled={loading || !code.trim()}>{loading && <Loader2 className="w-4 h-4 animate-spin mr-1" />}Receive</Button>
              </form>
            ) : mode === 'putawayPu' ? (
              puRows ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    {puRows.map((r) => (
                      <div key={r.id} className="flex justify-between text-sm p-2 rounded border">
                        <div><div className="font-medium">{r.product?.name}</div><div className="text-xs text-muted-foreground">{r.bin?.name}</div></div>
                        <span className="tabular-nums">{r.quantity}</span>
                      </div>
                    ))}
                  </div>
                  <SearchableSelect options={bins} value={destBin} onValueChange={setDestBin} placeholder="Destination bin" />
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setPuRows(null)} disabled={saving}>Back</Button>
                    <Button className="flex-1" onClick={doPutAwayPu} disabled={saving || !destBin}>{saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}Put Away PU</Button>
                  </div>
                </div>
              ) : (
                <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); lookupPu(); }}>
                  <Input autoFocus value={puCode} onChange={(e) => setPuCode(e.target.value)} placeholder="PU number" />
                  <Button type="submit" className="w-full" disabled={loading || !puCode.trim()}>{loading && <Loader2 className="w-4 h-4 animate-spin mr-1" />}Find PU</Button>
                </form>
              )
            ) : loading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : selected ? (
              <div className="space-y-3">
                <div className="text-sm"><div className="font-medium">{selected.product?.name}</div><div className="text-xs text-muted-foreground">From {selected.bin?.name} · {selected.quantity} available</div></div>
                <Input type="number" step="any" min={0} max={selected.quantity} value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Quantity" />
                <SearchableSelect options={bins} value={destBin} onValueChange={setDestBin} placeholder="Destination bin" />
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setSelected(null)} disabled={saving}>Back</Button>
                  <Button className="flex-1" onClick={doPutAway} disabled={saving || !destBin || !qty}>{saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}Put Away</Button>
                </div>
              </div>
            ) : stock.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">No stock waiting in goods receipt areas</p> :
              stock.map((s) => (
                <button key={s.id} onClick={() => { setSelected(s); setQty(String(s.quantity)); setDestBin(''); }} className="w-full flex justify-between items-center p-3 rounded-lg border hover:bg-muted/50 text-left">
                  <div><div className="text-sm font-medium">{s.product?.name}</div><div className="text-xs text-muted-foreground">{s.bin?.name}{s.pu_number ? ` · PU ${s.pu_number}` : ''}{s.product?.product_id ? ` · ${s.product.product_id}` : ''}</div></div>
                  <span className="text-sm tabular-nums">{s.quantity}</span>
                </button>
              ))}
          </div>
        </DialogContent>
      </Dialog>

      {receiving && (
        <ReceiveDeliveryDialog
          open={!!receiving}
          onOpenChange={(o) => { if (!o) setReceiving(null); }}
          deliveryId={receiving.id}
          deliveryDisplayId={receiving.delivery_id}
          purchaseOrderId={receiving.purchase_order_id}
          locationId={locationId}
          puFilterId={receivePuId}
          onReceived={() => { setReceiving(null); setMode(null); onDone(); }}
        />
      )}
    </>
  );
}
