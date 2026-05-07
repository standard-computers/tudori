import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Loader2 } from 'lucide-react';
import { toast } from '@/lib/toast';

interface POItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number | null;
  product?: { name: string; product_id: string };
}

interface DeliveryItemSelection {
  product_id: string;
  product_name: string;
  product_code: string;
  po_quantity: number;
  delivery_quantity: number;
  selected: boolean;
}

interface DeliveryItemsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrderId: string;
  companyId: string;
  onConfirm: (items: { product_id: string; quantity: number }[]) => void;
  title?: string;
  description?: string;
}

export const DeliveryItemsDialog = ({
  open,
  onOpenChange,
  purchaseOrderId,
  companyId,
  onConfirm,
  title = 'Select Delivery Items',
  description = 'Choose which items to include in this delivery.',
}: DeliveryItemsDialogProps) => {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<DeliveryItemSelection[]>([]);
  const [selectAll, setSelectAll] = useState(true);

  useEffect(() => {
    if (open && purchaseOrderId) {
      fetchPOItems();
    }
  }, [open, purchaseOrderId]);

  const fetchPOItems = async () => {
    setLoading(true);
    const [{ data, error }, { data: existingDeliveries, error: delErr }] = await Promise.all([
      supabase
        .from('purchase_order_items')
        .select(`
          id,
          product_id,
          quantity,
          unit_price,
          product:products(name, product_id)
        `)
        .eq('purchase_order_id', purchaseOrderId),
      supabase
        .from('deliveries')
        .select('id, status, delivery_items(product_id, quantity)')
        .eq('purchase_order_id', purchaseOrderId),
    ]);

    if (error || delErr) {
      toast.error('Failed to load PO items');
      setLoading(false);
      return;
    }

    // Sum already-delivered/in-progress quantities per product (exclude canceled)
    const deliveredByProduct: Record<string, number> = {};
    for (const d of (existingDeliveries || []) as any[]) {
      if ((d.status || '').toLowerCase() === 'canceled' || (d.status || '').toLowerCase() === 'cancelled') continue;
      for (const di of (d.delivery_items || []) as any[]) {
        deliveredByProduct[di.product_id] = (deliveredByProduct[di.product_id] || 0) + (di.quantity || 0);
      }
    }

    const selections: DeliveryItemSelection[] = (data || []).map((item: POItem) => {
      const remaining = Math.max(0, item.quantity - (deliveredByProduct[item.product_id] || 0));
      return {
        product_id: item.product_id,
        product_name: item.product?.name || 'Unknown',
        product_code: item.product?.product_id || '',
        po_quantity: remaining,
        delivery_quantity: remaining,
        selected: remaining > 0,
      };
    }).filter(s => s.po_quantity > 0);

    setItems(selections);
    setSelectAll(selections.every(s => s.selected));
    setLoading(false);
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    setItems(items.map(item => ({ ...item, selected: checked })));
  };

  const handleItemSelect = (productId: string, checked: boolean) => {
    const updated = items.map(item =>
      item.product_id === productId ? { ...item, selected: checked } : item
    );
    setItems(updated);
    setSelectAll(updated.every(item => item.selected));
  };

  const handleQuantityChange = (productId: string, quantity: number) => {
    setItems(items.map(item =>
      item.product_id === productId
        ? { ...item, delivery_quantity: Math.min(Math.max(1, quantity), item.po_quantity) }
        : item
    ));
  };

  const handleConfirm = () => {
    const selectedItems = items
      .filter(item => item.selected && item.delivery_quantity > 0)
      .map(item => ({
        product_id: item.product_id,
        quantity: item.delivery_quantity,
      }));

    onConfirm(selectedItems);
    onOpenChange(false);
  };

  const selectedCount = items.filter(i => i.selected).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8 px-6">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 px-6 text-muted-foreground">
            No items found in this purchase order.
          </div>
        ) : (
          <div className="flex-1 overflow-auto px-6">
            <div className="flex items-center gap-2 mb-4 pb-2 border-b">
              <Checkbox
                id="select-all"
                checked={selectAll}
                onCheckedChange={(checked) => handleSelectAll(checked === true)}
              />
              <Label htmlFor="select-all" className="font-medium cursor-pointer">
                Select All Items ({items.length})
              </Label>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="w-24 text-right">Remaining</TableHead>
                  <TableHead className="w-32 text-right">Delivery Qty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.product_id}>
                    <TableCell>
                      <Checkbox
                        checked={item.selected}
                        onCheckedChange={(checked) =>
                          handleItemSelect(item.product_id, checked === true)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{item.product_name}</div>
                        <div className="text-sm text-muted-foreground font-mono">
                          {item.product_code}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{item.po_quantity}</TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min={1}
                        max={item.po_quantity}
                        value={item.delivery_quantity}
                        onChange={(e) =>
                          handleQuantityChange(item.product_id, parseInt(e.target.value) || 1)
                        }
                        className="w-20 text-right ml-auto"
                        disabled={!item.selected}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={selectedCount === 0}>
            Confirm ({selectedCount} items)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
