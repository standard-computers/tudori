import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { postGoodsReceipt } from '@/lib/inventory-posting';
import { createPackagingUnit } from '@/lib/packaging-units';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Kbd } from '@/components/ui/kbd';
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
import { Loader2, PackageCheck, AlertCircle, Layers } from 'lucide-react';
import { toast } from 'sonner';

interface DeliveryItem {
  id: string;
  product_id: string;
  quantity: number;
  notes: string | null;
  pu_id?: string | null;
  product?: { name: string; product_id: string };
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
}

interface ReceiveDeliveryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deliveryId: string;
  deliveryDisplayId: string;
  purchaseOrderId: string | null;
  locationId: string;
  onReceived: () => void;
}

export const ReceiveDeliveryDialog = ({
  open,
  onOpenChange,
  deliveryId,
  deliveryDisplayId,
  purchaseOrderId,
  locationId,
  onReceived,
}: ReceiveDeliveryDialogProps) => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [items, setItems] = useState<ReceivedItem[]>([]);
  const [explodeDelivery, setExplodeDelivery] = useState(false);
  const [isInternalTransfer, setIsInternalTransfer] = useState(false);
  const [isFulfilled, setIsFulfilled] = useState(true);

  useEffect(() => {
    if (open && deliveryId) {
      fetchDeliveryItems();
      checkInternalTransferStatus();
      setExplodeDelivery(false);
    }
  }, [open, deliveryId]);

  const checkInternalTransferStatus = async () => {
    // Check if this delivery is from an internal source and if it's fulfilled
    const { data: delivery } = await supabase
      .from('deliveries')
      .select('is_fulfilled, purchase_order_id')
      .eq('id', deliveryId)
      .single();

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
        product:products(name, product_id)
      `)
      .eq('delivery_id', deliveryId);

    if (error) {
      toast.error('Failed to load delivery items');
      setLoading(false);
      return;
    }

    const receivedItems: ReceivedItem[] = (data || []).map((item: DeliveryItem) => ({
      id: item.id,
      product_id: item.product_id,
      product_name: item.product?.name || 'Unknown',
      product_code: item.product?.product_id || '',
      expected_quantity: item.quantity,
      received_quantity: item.quantity,
      pu_id: item.pu_id || null,
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

  const handleReceive = async () => {
    setSubmitting(true);

    try {
      // Get user's company_id for creating goods receipt
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!profile?.company_id) {
        toast.error('Could not determine company');
        setSubmitting(false);
        return;
      }

      // Check if GR is required from process controls
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

      // Update delivery status to delivered
      const { error: deliveryError } = await supabase
        .from('deliveries')
        .update({ 
          status: 'delivered',
          delivered_date: new Date().toISOString().split('T')[0]
        })
        .eq('id', deliveryId);

      if (deliveryError) {
        toast.error('Failed to update delivery status');
        setSubmitting(false);
        return;
      }

      // Update delivery items with received quantities if different
      for (const item of items) {
        if (item.received_quantity !== item.expected_quantity) {
          await supabase
            .from('delivery_items')
            .update({ 
              quantity: item.received_quantity,
              notes: item.received_quantity < item.expected_quantity 
                ? `Received ${item.received_quantity} of ${item.expected_quantity} expected`
                : null
            })
            .eq('id', item.id);
        }
      }

      if (requireGR) {
        // Create goods receipt
        const { data: receiptNumber, error: receiptNumError } = await supabase.rpc(
          'get_next_goods_receipt_number',
          { p_company_id: profile.company_id }
        );

        if (receiptNumError || !receiptNumber) {
          toast.error('Failed to generate receipt number');
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
          toast.error('Failed to create goods receipt');
          setSubmitting(false);
          return;
        }

        // Create goods receipt items from received quantities
        // If explodeDelivery is true, create individual PUs for each unit
        if (explodeDelivery) {
          // Create PUs and GR items for each individual unit
          for (const item of items) {
            if (item.received_quantity <= 0) continue;
            
            for (let i = 0; i < item.received_quantity; i++) {
              // Check if delivery item already has a PU assigned
              let puId = item.pu_id;
              
              if (!puId) {
                // Create a new PU for this unit
                const pu = await createPackagingUnit(profile.company_id, item.product_id, 1);
                puId = pu?.id || null;
              }
              
              // Create GR item with PU
              await supabase
                .from('goods_receipt_items')
                .insert({
                  goods_receipt_id: goodsReceipt.id,
                  product_id: item.product_id,
                  quantity: 1,
                  pu_id: puId,
                  notes: `Unit ${i + 1} of ${item.received_quantity}`,
                });
            }
          }
        } else {
          // Standard behavior: create GR items without individual PUs
          // But still create PUs if not already assigned
          const grItems = [];
          for (const item of items) {
            if (item.received_quantity <= 0) continue;
            
            let puId = item.pu_id;
            
            // If no PU assigned, create one for the full quantity
            if (!puId) {
              const pu = await createPackagingUnit(profile.company_id, item.product_id, item.received_quantity);
              puId = pu?.id || null;
            }
            
            grItems.push({
              goods_receipt_id: goodsReceipt.id,
              product_id: item.product_id,
              quantity: item.received_quantity,
              pu_id: puId,
              notes: item.received_quantity !== item.expected_quantity 
                ? `Received ${item.received_quantity} of ${item.expected_quantity} expected`
                : null,
            });
          }
          
          if (grItems.length > 0) {
            const { error: itemsError } = await supabase
              .from('goods_receipt_items')
              .insert(grItems);

            if (itemsError) {
              console.error('Failed to create goods receipt items:', itemsError);
            }
          }
        }

        // Auto-post the goods receipt to update inventory
        const postResult = await postGoodsReceipt(goodsReceipt.id, locationId);
        if (postResult.success) {
          toast.success(`Goods Receipt ${receiptNumber} created and posted - inventory updated.`);
        } else {
          toast.error(postResult.error || 'Failed to auto-post goods receipt');
        }
      } else {
        // Directly post inventory without creating a GR
        // Still generate PUs for tracking
        for (const item of items) {
          if (item.received_quantity <= 0) continue;
          
          if (explodeDelivery) {
            // Create individual inventory records with PUs
            for (let i = 0; i < item.received_quantity; i++) {
              const pu = await createPackagingUnit(profile.company_id, item.product_id, 1);
              await supabase
                .from('inventory')
                .insert({
                  location_id: locationId,
                  product_id: item.product_id,
                  quantity: 1,
                  pu_id: pu?.id || null,
                });
            }
          } else {
            // Create PU for the batch
            const pu = await createPackagingUnit(profile.company_id, item.product_id, item.received_quantity);
            
            // Check if inventory record exists for this product at this location (without PU)
            const { data: existingInventory } = await supabase
              .from('inventory')
              .select('id, quantity')
              .eq('location_id', locationId)
              .eq('product_id', item.product_id)
              .is('pu_id', null)
              .maybeSingle();

            if (existingInventory) {
              // Update existing inventory
              await supabase
                .from('inventory')
                .update({ 
                  quantity: existingInventory.quantity + item.received_quantity,
                  updated_at: new Date().toISOString()
                })
                .eq('id', existingInventory.id);
            } else {
              // Create new inventory record with PU
              await supabase
                .from('inventory')
                .insert({
                  location_id: locationId,
                  product_id: item.product_id,
                  quantity: item.received_quantity,
                  pu_id: pu?.id || null,
                });
            }
          }
        }

        toast.success('Delivery received and inventory updated directly.');
      }

      // If there's an associated PO, mark it as delivered
      if (purchaseOrderId) {
        const { error: poError } = await supabase
          .from('purchase_orders')
          .update({ status: 'delivered' })
          .eq('id', purchaseOrderId);

        if (poError) {
          console.error('Failed to update PO status:', poError);
        }
      }

      onReceived();
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to receive delivery');
    } finally {
      setSubmitting(false);
    }
  };

  const displayItems = getDisplayItems();
  const hasPackedItems = items.some(item => item.pu_id);
  const hasDiscrepancy = items.some(item => item.received_quantity !== item.expected_quantity);
  const totalExpected = items.reduce((sum, item) => sum + item.expected_quantity, 0);
  const totalReceived = items.reduce((sum, item) => sum + item.received_quantity, 0);

  return (
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
                {explodeDelivery ? (
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
            <Kbd>Esc</Kbd>
          </Button>
          <Button 
            onClick={handleReceive} 
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
  );
};