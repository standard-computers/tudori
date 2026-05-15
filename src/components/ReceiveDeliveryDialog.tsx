import { useState, useEffect, useCallback } from 'react';
import { useSaveShortcut } from '@/hooks/use-keyboard-shortcut';
import { supabase } from '@/integrations/supabase/client';
import { postGoodsReceipt } from '@/lib/inventory-posting';
import { createPackagingUnit } from '@/lib/packaging-units';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Kbd } from '@/components/ui/kbd';
import { SearchableSelect } from '@/components/SearchableSelect';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, PackageCheck, AlertCircle, Layers, Package, Archive } from 'lucide-react';
import { toast } from '@/lib/toast';
import { BatchAssignmentDialog, BatchedProduct } from '@/components/cockpit/BatchAssignmentDialog';
import { ImportProgressDialog, ImportResult } from '@/components/ImportProgressDialog';

interface DeliveryItem {
  id: string;
  product_id: string;
  quantity: number;
  notes: string | null;
  pu_id?: string | null;
  packaging_unit?: { pu_number: string } | null;
  product?: { name: string; product_id: string; hazardous?: boolean; is_batched?: boolean };
}

interface ReceivedItem {
  id: string;
  product_id: string;
  product_name: string;
  product_code: string;
  expected_quantity: number;
  received_quantity: number;
  pu_id?: string | null;
  pu_number?: string | null;
  hazardous?: boolean;
  is_batched?: boolean;
  uom_id?: string | null;
  uom_label?: string | null;
}

interface ReceiveDeliveryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deliveryId: string;
  deliveryDisplayId: string;
  purchaseOrderId: string | null;
  locationId: string;
  onReceived: () => void;
  onFullyComplete?: () => void;
}

export const ReceiveDeliveryDialog = ({
  open,
  onOpenChange,
  deliveryId,
  deliveryDisplayId,
  purchaseOrderId,
  locationId,
  onReceived,
  onFullyComplete,
}: ReceiveDeliveryDialogProps) => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [items, setItems] = useState<ReceivedItem[]>([]);
  const [explodeDelivery, setExplodeDelivery] = useState(false);
  const [isInternalTransfer, setIsInternalTransfer] = useState(false);
  const [isFulfilled, setIsFulfilled] = useState(true);
  const [selectedBinId, setSelectedBinId] = useState('');
  const [binOptions, setBinOptions] = useState<{ value: string; label: string; sublabel?: string; group?: string; is_hazardous?: boolean }[]>([]);
  const [showBatchDialog, setShowBatchDialog] = useState(false);
  const [batchedProducts, setBatchedProducts] = useState<BatchedProduct[]>([]);
  const [pendingBatchData, setPendingBatchData] = useState<BatchedProduct[] | null>(null);
  const [showProgress, setShowProgress] = useState(false);
  const [progressResults, setProgressResults] = useState<ImportResult[]>([]);
  const [progressTotal, setProgressTotal] = useState(0);
  const [progressProcessed, setProgressProcessed] = useState(0);
  const [progressComplete, setProgressComplete] = useState(false);

  const canConfirm = !submitting && items.length > 0 && !(isInternalTransfer && !isFulfilled);
  useSaveShortcut(useCallback(() => {
    if (canConfirm) handleConfirmClick();
  }, [canConfirm]), open);

  useEffect(() => {
    if (open && deliveryId) {
      fetchDeliveryItems();
      checkInternalTransferStatus();
      fetchBinsForLocation();
      setExplodeDelivery(false);
      setSelectedBinId('');
    }
  }, [open, deliveryId]);

  const fetchBinsForLocation = async () => {
    // Check for areas with goods receipt enabled
    const { data: grAreas } = await supabase
      .from('areas')
      .select('id, name')
      .eq('location_id', locationId)
      .eq('is_goods_receipt_enabled', true);

    const hasGrAreas = grAreas && grAreas.length > 0;

    let targetAreas: { id: string; name: string }[];
    if (hasGrAreas) {
      targetAreas = grAreas;
    } else {
      // No GR-enabled areas — fall back to all areas at this location
      const { data: allAreas } = await supabase
        .from('areas')
        .select('id, name')
        .eq('location_id', locationId);
      targetAreas = allAreas || [];
    }

    if (targetAreas.length === 0) {
      setBinOptions([]);
      return;
    }

    const areaIds = targetAreas.map(a => a.id);
    const { data: bins } = await supabase
      .from('bins')
      .select('id, bin_id, name, area_id, allow_put_away, is_hazardous')
      .in('area_id', areaIds)
      .eq('allow_put_away', true)
      .order('bin_id');

    if (!bins || bins.length === 0) {
      setBinOptions([]);
      return;
    }

    const areaMap = Object.fromEntries(targetAreas.map(a => [a.id, a.name]));
    setBinOptions(
      bins.map((bin: any) => ({
        value: bin.id,
        label: bin.bin_id,
        sublabel: bin.name,
        group: areaMap[bin.area_id] || 'Unknown Area',
        is_hazardous: bin.is_hazardous ?? false,
      }))
    );

    // Auto-select: find the first empty bin in the first GR-enabled area
    if (hasGrAreas) {
      const firstGrAreaId = grAreas[0].id;
      const grAreaBins = bins.filter(b => b.area_id === firstGrAreaId);

      if (grAreaBins.length > 0) {
        // Check which bins have inventory (non-empty)
        const grAreaBinIds = grAreaBins.map(b => b.id);
        const { data: occupiedBins } = await supabase
          .from('inventory')
          .select('bin_id')
          .in('bin_id', grAreaBinIds)
          .gt('quantity', 0);

        const occupiedBinIds = new Set((occupiedBins || []).map(inv => inv.bin_id));
        const firstEmptyBin = grAreaBins.find(b => !occupiedBinIds.has(b.id));

        if (firstEmptyBin) {
          setSelectedBinId(firstEmptyBin.id);
        } else {
          // All bins occupied — default to first bin in the GR area
          setSelectedBinId(grAreaBins[0].id);
        }
      }
    }
  };

  const checkInternalTransferStatus = async () => {
    // Check if this delivery is from an internal source and if it's fulfilled
    const { data: delivery } = await supabase
      .from('deliveries')
      .select('is_fulfilled, purchase_order_id, outbound_delivery_id')
      .eq('id', deliveryId)
      .single();

    // If this delivery was auto-created from outbound fulfillment, it's already fulfilled
    if (delivery?.outbound_delivery_id) {
      setIsInternalTransfer(true);
      setIsFulfilled(true);
      return;
    }

    if (delivery?.purchase_order_id) {
      // Check if the PO has a source_location_id (internal transfer)
      const { data: po } = await supabase
        .from('purchase_orders')
        .select('source_location_id')
        .eq('id', delivery.purchase_order_id)
        .single();

      if (po?.source_location_id) {
        setIsInternalTransfer(true);
        setIsFulfilled(delivery?.is_fulfilled ?? false);
      } else {
        setIsInternalTransfer(false);
        setIsFulfilled(true);
      }
    } else {
      setIsInternalTransfer(false);
      setIsFulfilled(true);
    }
  };

  const fetchDeliveryItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('delivery_items')
      .select(`
        id,
        product_id,
        quantity,
        notes,
        pu_id,
        uom_id,
        packaging_unit:packaging_units(pu_number),
        product:products(name, product_id, hazardous, is_batched),
        uom:product_uoms(id, name, abbreviation, conversion_factor)
      `)
      .eq('delivery_id', deliveryId);

    if (error) {
      toast.error('Failed to load delivery items');
      setLoading(false);
      return;
    }

    const receivedItems: ReceivedItem[] = (data || []).map((item: any) => ({
      id: item.id,
      product_id: item.product_id,
      product_name: item.product?.name || 'Unknown',
      product_code: item.product?.product_id || '',
      expected_quantity: item.quantity,
      received_quantity: item.quantity,
      pu_id: item.pu_id || null,
      pu_number: item.packaging_unit?.pu_number || null,
      hazardous: item.product?.hazardous ?? false,
      is_batched: item.product?.is_batched ?? false,
      uom_id: item.uom_id || null,
      uom_label: item.uom?.abbreviation || item.uom?.name || null,
    }));

    setItems(receivedItems);
    setLoading(false);
  };

  const handleQuantityChange = (itemId: string, quantity: number) => {
    setItems(items.map(item =>
      item.id === itemId
        ? { ...item, received_quantity: Math.max(0, quantity) }
        : item
    ));
  };

  // Get display items - exploded or normal
  const getDisplayItems = (): ReceivedItem[] => {
    if (!explodeDelivery) return items;
    
    // Explode each item into individual lines
    const explodedItems: ReceivedItem[] = [];
    items.forEach(item => {
      for (let i = 0; i < item.received_quantity; i++) {
        explodedItems.push({
          ...item,
          id: `${item.id}-${i}`,
          expected_quantity: 1,
          received_quantity: 1,
        });
      }
    });
    return explodedItems;
  };

  const handleConfirmClick = () => {
    // Check if any received items are batch-managed
    const batchItems = items.filter(item => item.is_batched && item.received_quantity > 0);
    
    if (batchItems.length > 0) {
      // Build batched products for the dialog
      const bp: BatchedProduct[] = batchItems.map(item => ({
        itemId: item.id,
        productId: item.product_id,
        productName: item.product_name,
        productCode: item.product_code,
        totalQuantity: item.received_quantity,
        batchLines: [{ batchNumber: '', expirationDate: '', quantity: item.received_quantity }],
      }));
      setBatchedProducts(bp);
      setShowBatchDialog(true);
      return;
    }

    // No batched products — proceed directly
    handleReceive(null);
  };

  const handleBatchConfirm = (confirmedProducts: BatchedProduct[]) => {
    setShowBatchDialog(false);
    setPendingBatchData(confirmedProducts);
    handleReceive(confirmedProducts);
  };

  const addProgress = (row: number, status: 'success' | 'error', message: string) => {
    setProgressResults(prev => [...prev, { row, status, message }]);
    setProgressProcessed(prev => prev + 1);
  };

  const handleReceive = async (batchData: BatchedProduct[] | null) => {
    setSubmitting(true);

    // Calculate total steps: profile(1) + settings(1) + delivery update(1) + items(N for PU creation) + GR creation(1) + GR items(1) + posting(1) + PO update(1 if applicable)
    const activeItems = items.filter(i => i.received_quantity > 0);
    const estimatedSteps = 3 + activeItems.length + 3 + (purchaseOrderId ? 1 : 0);
    setProgressTotal(estimatedSteps);
    setProgressProcessed(0);
    setProgressResults([]);
    setProgressComplete(false);

    // Close the receive dialog and show progress
    onOpenChange(false);
    setShowProgress(true);

    let step = 0;

    try {
      // Step: Get profile
      step++;
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!profile?.company_id) {
        addProgress(step, 'error', 'Could not determine company');
        setProgressComplete(true);
        setSubmitting(false);
        return;
      }
      addProgress(step, 'success', 'Company profile loaded');

      // Step: Check process controls
      step++;
      const { data: processControlsSetting } = await supabase
        .from('company_settings')
        .select('setting_value')
        .eq('company_id', profile.company_id)
        .eq('setting_key', 'process_controls')
        .maybeSingle();

      const requireGR = processControlsSetting?.setting_value && 
        typeof processControlsSetting.setting_value === 'object' && 
        !Array.isArray(processControlsSetting.setting_value)
          ? ((processControlsSetting.setting_value as Record<string, unknown>).require_gr_on_delivery as boolean) ?? true
          : true;
      addProgress(step, 'success', 'Process controls checked');

      // Step: Update delivery status
      step++;
      const isPartialReceipt = items.some(item => item.received_quantity < item.expected_quantity);
      const { error: deliveryError } = await supabase
        .from('deliveries')
        .update({ 
          status: isPartialReceipt ? 'partially_delivered' : 'delivered',
          delivered_date: new Date().toISOString().split('T')[0]
        })
        .eq('id', deliveryId);

      if (deliveryError) {
        addProgress(step, 'error', 'Failed to update delivery status');
        setProgressComplete(true);
        setSubmitting(false);
        return;
      }
      addProgress(step, 'success', `Delivery marked as ${isPartialReceipt ? 'partially delivered' : 'delivered'}`);

      if (requireGR) {
        // Step: Create PUs for each item
        const puMap: Record<string, string | null> = {};
        for (const item of activeItems) {
          step++;
          let puId = item.pu_id;

          if (!puId && !explodeDelivery) {
            const pu = await createPackagingUnit(profile.company_id, item.product_id, item.received_quantity);
            puId = pu?.id || null;
          }
          puMap[item.id] = puId;
          addProgress(step, 'success', `PU ready for ${item.product_name}`);
        }

        // Step: Create Goods Receipt
        step++;
        const { data: receiptNumber, error: receiptNumError } = await supabase.rpc(
          'get_next_goods_receipt_number',
          { p_company_id: profile.company_id }
        );

        if (receiptNumError || !receiptNumber) {
          addProgress(step, 'error', 'Failed to generate receipt number');
          setProgressComplete(true);
          setSubmitting(false);
          return;
        }

        const { data: goodsReceipt, error: grError } = await supabase
          .from('goods_receipts')
          .insert({
            company_id: profile.company_id,
            receipt_number: receiptNumber,
            location_id: locationId,
            delivery_id: deliveryId,
            purchase_order_id: purchaseOrderId || null,
            receipt_date: new Date().toISOString().split('T')[0],
            status: 'pending',
            notes: `Auto-created from delivery ${deliveryDisplayId}`,
          })
          .select()
          .single();

        if (grError || !goodsReceipt) {
          addProgress(step, 'error', 'Failed to create Goods Receipt');
          setProgressComplete(true);
          setSubmitting(false);
          return;
        }
        addProgress(step, 'success', `Goods Receipt ${receiptNumber} created`);

        // Step: Create GR items
        step++;
        if (explodeDelivery) {
          for (const item of activeItems) {
            for (let i = 0; i < item.received_quantity; i++) {
              let puId = item.pu_id;
              if (!puId) {
                const pu = await createPackagingUnit(profile.company_id, item.product_id, 1);
                puId = pu?.id || null;
              }
              await supabase.from('goods_receipt_items').insert({
                goods_receipt_id: goodsReceipt.id,
                product_id: item.product_id,
                quantity: 1,
                pu_id: puId,
                bin_id: selectedBinId || null,
                notes: `Unit ${i + 1} of ${item.received_quantity}`,
              });
            }
          }
        } else {
          const grItems: any[] = [];
          for (const item of activeItems) {
            const puId = puMap[item.id];
            const batchProduct = batchData?.find(bp => bp.itemId === item.id);
            
            if (batchProduct && batchProduct.batchLines.length > 0) {
              for (const batchLine of batchProduct.batchLines) {
                const { data: existingBatch } = await supabase
                  .from('batches')
                  .select('id')
                  .eq('company_id', profile.company_id)
                  .eq('product_id', item.product_id)
                  .eq('batch_number', batchLine.batchNumber)
                  .maybeSingle();

                let batchId: string;
                if (existingBatch) {
                  batchId = existingBatch.id;
                  if (batchLine.expirationDate) {
                    await supabase.from('batches').update({ expiration_date: batchLine.expirationDate }).eq('id', batchId);
                  }
                } else {
                  const { data: newBatch } = await supabase
                    .from('batches')
                    .insert({
                      company_id: profile.company_id,
                      product_id: item.product_id,
                      batch_number: batchLine.batchNumber,
                      expiration_date: batchLine.expirationDate || null,
                    })
                    .select('id')
                    .single();
                  batchId = newBatch!.id;
                }

                grItems.push({
                  goods_receipt_id: goodsReceipt.id,
                  product_id: item.product_id,
                  quantity: batchLine.quantity,
                  pu_id: puId,
                  bin_id: selectedBinId || null,
                  batch_id: batchId,
                  notes: `Batch: ${batchLine.batchNumber}`,
                });
              }
            } else {
              grItems.push({
                goods_receipt_id: goodsReceipt.id,
                product_id: item.product_id,
                quantity: item.received_quantity,
                pu_id: puId,
                bin_id: selectedBinId || null,
                notes: item.received_quantity !== item.expected_quantity 
                  ? `Received ${item.received_quantity} of ${item.expected_quantity} expected`
                  : null,
              });
            }
          }
          
          if (grItems.length > 0) {
            const { error: itemsError } = await supabase.from('goods_receipt_items').insert(grItems);
            if (itemsError) {
              addProgress(step, 'error', 'Failed to create GR items');
              setProgressComplete(true);
              setSubmitting(false);
              return;
            }
          }
        }
        addProgress(step, 'success', 'GR items created');

        // Step: Post GR
        step++;
        const postResult = await postGoodsReceipt(goodsReceipt.id, locationId);
        if (postResult.success) {
          addProgress(step, 'success', `GR ${receiptNumber} posted — inventory updated`);
        } else {
          addProgress(step, 'error', postResult.error || 'Failed to post Goods Receipt');
        }
      } else {
        // Direct inventory update without GR
        for (const item of activeItems) {
          step++;
          if (explodeDelivery) {
            for (let i = 0; i < item.received_quantity; i++) {
              const pu = await createPackagingUnit(profile.company_id, item.product_id, 1);
              await supabase.from('inventory').insert({
                location_id: locationId,
                product_id: item.product_id,
                quantity: 1,
                pu_id: pu?.id || null,
                bin_id: selectedBinId || null,
              });
            }
          } else {
            const puId = item.pu_id || (await createPackagingUnit(profile.company_id, item.product_id, item.received_quantity))?.id || null;
            await supabase.from('inventory').insert({
              location_id: locationId,
              product_id: item.product_id,
              quantity: item.received_quantity,
              pu_id: puId,
              bin_id: selectedBinId || null,
            });
          }
          addProgress(step, 'success', `Inventory updated for ${item.product_name}`);
        }

        // Add the remaining placeholder steps
        step++;
        addProgress(step, 'success', 'Direct inventory posting complete');
        step++;
        addProgress(step, 'success', 'Finalized');
      }

      // Step: Update PO if applicable
      if (purchaseOrderId) {
        step++;
        const { error: poError } = await supabase
          .from('purchase_orders')
          .update({ status: 'delivered' })
          .eq('id', purchaseOrderId);

        if (poError) {
          addProgress(step, 'error', 'Failed to update Purchase Order status');
        } else {
          addProgress(step, 'success', 'Purchase Order marked as delivered');
        }

        const { data: poData } = await supabase
          .from('purchase_orders')
          .select('requisition_id')
          .eq('id', purchaseOrderId)
          .single();

        if (poData?.requisition_id) {
          await supabase
            .from('requisitions')
            .update({ status: 'completed' })
            .eq('id', poData.requisition_id);
        }
      }

      onReceived();
    } catch (error) {
      addProgress(step, 'error', 'Unexpected error during receiving');
    } finally {
      setProgressComplete(true);
      setSubmitting(false);
    }
  };

  const displayItems = getDisplayItems();
  const hasPackedItems = items.some(item => item.pu_id);
  const hasDiscrepancy = items.some(item => item.received_quantity !== item.expected_quantity);
  const totalExpected = items.reduce((sum, item) => sum + item.expected_quantity, 0);
  const totalReceived = items.reduce((sum, item) => sum + item.received_quantity, 0);

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-green-500" />
            Receive Delivery - {deliveryDisplayId}
          </DialogTitle>
          <DialogDescription>
            Confirm received quantities for each item. Adjust if there are discrepancies.
          </DialogDescription>
        </DialogHeader>

        {!loading && items.length > 0 && binOptions.length > 0 && (
          <div className="flex items-center gap-3 px-4 py-2">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground whitespace-nowrap">
              <Archive className="w-4 h-4" />
              Put Away To
            </div>
            <SearchableSelect
              options={(() => {
                const anyHazardous = items.some(i => i.hazardous);
                return binOptions.filter(b => anyHazardous || !b.is_hazardous);
              })()}
              value={selectedBinId}
              onValueChange={setSelectedBinId}
              placeholder="Select bin..."
              allowClear
              clearLabel="No bin (location level)"
              className="flex-1"
            />
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No items found in this delivery.</p>
            <p className="text-sm mt-2">This delivery has no items to receive.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="w-24 text-right">Expected</TableHead>
                  <TableHead className="w-32 text-right">Received</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hasPackedItems ? (
                  // Group items by PU for packed deliveries
                  (() => {
                    const grouped = items.reduce((acc, item) => {
                      const key = item.pu_id || '__unpacked__';
                      if (!acc[key]) acc[key] = { puNumber: item.pu_number, items: [] };
                      acc[key].items.push(item);
                      return acc;
                    }, {} as Record<string, { puNumber: string | null; items: ReceivedItem[] }>);

                    return Object.entries(grouped).flatMap(([puKey, group]) => [
                      <TableRow key={`pu-header-${puKey}`} className="bg-muted/50">
                        <TableCell colSpan={3} className="py-1.5">
                          <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                            <Package className="w-3.5 h-3.5" />
                            {puKey === '__unpacked__' ? 'Unpacked Items' : group.puNumber || puKey}
                          </div>
                        </TableCell>
                      </TableRow>,
                      ...group.items.map((item) => (
                        <TableRow key={item.id} className={item.received_quantity !== item.expected_quantity ? 'bg-amber-500/5' : ''}>
                          <TableCell>
                            <div className="pl-4">
                              <div className="font-medium">{item.product_name}</div>
                              <div className="text-sm text-muted-foreground font-mono">
                                {item.product_code}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">{item.expected_quantity}</TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              min={0}
                              value={item.received_quantity}
                              onChange={(e) =>
                                handleQuantityChange(item.id, parseInt(e.target.value) || 0)
                              }
                              className={`w-20 text-right ml-auto ${
                                item.received_quantity !== item.expected_quantity 
                                  ? 'border-amber-500 focus-visible:ring-amber-500' 
                                  : ''
                              }`}
                            />
                          </TableCell>
                        </TableRow>
                      )),
                    ]);
                  })()
                ) : explodeDelivery ? (
                  displayItems.map((item, index) => (
                    <TableRow key={`${item.id}-${index}`}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{item.product_name}</div>
                          <div className="text-sm text-muted-foreground font-mono">
                            {item.product_code}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">1</TableCell>
                      <TableCell className="text-right font-medium">1</TableCell>
                    </TableRow>
                  ))
                ) : (
                  items.map((item) => (
                    <TableRow key={item.id} className={item.received_quantity !== item.expected_quantity ? 'bg-amber-500/5' : ''}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{item.product_name}</div>
                          <div className="text-sm text-muted-foreground font-mono">
                            {item.product_code}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">{item.expected_quantity}</TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min={0}
                          value={item.received_quantity}
                          onChange={(e) =>
                            handleQuantityChange(item.id, parseInt(e.target.value) || 0)
                          }
                          className={`w-20 text-right ml-auto ${
                            item.received_quantity !== item.expected_quantity 
                              ? 'border-amber-500 focus-visible:ring-amber-500' 
                              : ''
                          }`}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {hasDiscrepancy && !explodeDelivery && (
              <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-amber-600">Quantity discrepancy detected</p>
                  <p className="text-muted-foreground">
                    Receiving {totalReceived} of {totalExpected} expected items.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="mt-4 flex-wrap gap-2">
          {!hasPackedItems && (
            <div className="flex items-center gap-2 mr-auto">
              <Checkbox
                id="explode-delivery"
                checked={explodeDelivery}
                onCheckedChange={(checked) => setExplodeDelivery(checked === true)}
                disabled={items.length === 0}
              />
              <Label 
                htmlFor="explode-delivery" 
                className="text-sm text-muted-foreground cursor-pointer flex items-center gap-1.5"
              >
                <Layers className="w-3.5 h-3.5" />
                Explode Delivery
              </Label>
            </div>
          )}
          <Button 
            onClick={handleConfirmClick} 
            disabled={submitting || items.length === 0 || (isInternalTransfer && !isFulfilled)}
            title={isInternalTransfer && !isFulfilled ? 'Source location must fulfill this transfer first' : undefined}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Receiving...
              </>
            ) : isInternalTransfer && !isFulfilled ? (
              'Awaiting Fulfillment'
            ) : (
              <>
                Confirm Receipt
                <Kbd className="ml-2">⌘S</Kbd>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <BatchAssignmentDialog
      open={showBatchDialog}
      onOpenChange={setShowBatchDialog}
      batchedProducts={batchedProducts}
      onConfirm={handleBatchConfirm}
    />

    <ImportProgressDialog
      open={showProgress}
      onOpenChange={(open) => {
        setShowProgress(open);
        if (!open) {
          onFullyComplete?.();
        }
      }}
      title={`Receiving Delivery ${deliveryDisplayId}`}
      totalRows={progressTotal}
      processedRows={progressProcessed}
      results={progressResults}
      isComplete={progressComplete}
    />
    </>
  );
};