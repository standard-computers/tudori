import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Loader2, PackageCheck, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface DeliveryItem {
  id: string;
  product_id: string;
  quantity: number;
  notes: string | null;
  product?: { name: string; product_id: string };
}

interface ReceivedItem {
  id: string;
  product_id: string;
  product_name: string;
  product_code: string;
  expected_quantity: number;
  received_quantity: number;
}

interface ReceiveDeliveryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deliveryId: string;
  deliveryDisplayId: string;
  purchaseOrderId: string | null;
  onReceived: () => void;
}

export const ReceiveDeliveryDialog = ({
  open,
  onOpenChange,
  deliveryId,
  deliveryDisplayId,
  purchaseOrderId,
  onReceived,
}: ReceiveDeliveryDialogProps) => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [items, setItems] = useState<ReceivedItem[]>([]);

  useEffect(() => {
    if (open && deliveryId) {
      fetchDeliveryItems();
    }
  }, [open, deliveryId]);

  const fetchDeliveryItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('delivery_items')
      .select(`
        id,
        product_id,
        quantity,
        notes,
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

  const handleReceive = async () => {
    setSubmitting(true);

    try {
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

      // If there's an associated PO, mark it as delivered
      if (purchaseOrderId) {
        const { error: poError } = await supabase
          .from('purchase_orders')
          .update({ status: 'delivered' })
          .eq('id', purchaseOrderId);

        if (poError) {
          console.error('Failed to update PO status:', poError);
          // Don't fail the whole operation, delivery is already marked
        }
      }

      toast.success('Delivery received successfully');
      onReceived();
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to receive delivery');
    } finally {
      setSubmitting(false);
    }
  };

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
                {items.map((item) => (
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
                ))}
              </TableBody>
            </Table>

            {hasDiscrepancy && (
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

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
            <Kbd>Esc</Kbd>
          </Button>
          <Button onClick={handleReceive} disabled={submitting || items.length === 0}>
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Receiving...
              </>
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
