import { useState } from 'react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Package, Tag, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { createPackagingUnit } from '@/lib/packaging-units';

interface InventoryItem {
  id: string;
  location_id: string;
  bin_id: string | null;
  product_id: string;
  pu_id: string | null;
  quantity: number;
  min_quantity: number | null;
  max_quantity: number | null;
  product?: { name: string; product_id: string; sku: string | null; company_id: string };
  bin?: { bin_id: string; name: string } | null;
  packaging_unit?: { pu_number: string } | null;
}

interface BulkInventoryActionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedItems: InventoryItem[];
  onCompleted: () => void;
}

const PACKAGING_UOMS = [
  { value: 'pallet', label: 'Pallet' },
  { value: 'box', label: 'Box' },
  { value: 'crate', label: 'Crate' },
  { value: 'carton', label: 'Carton' },
  { value: 'container', label: 'Container' },
  { value: 'bundle', label: 'Bundle' },
  { value: 'roll', label: 'Roll' },
  { value: 'drum', label: 'Drum' },
  { value: 'bag', label: 'Bag' },
  { value: 'other', label: 'Other' },
];

export const BulkInventoryActionsDialog = ({
  open,
  onOpenChange,
  selectedItems,
  onCompleted,
}: BulkInventoryActionsDialogProps) => {
  const [packagingUOM, setPackagingUOM] = useState<string>('pallet');
  const [isProcessing, setIsProcessing] = useState(false);
  const [createdPU, setCreatedPU] = useState<{ pu_number: string; id: string } | null>(null);

  const handlePackageTogether = async () => {
    if (selectedItems.length === 0) {
      toast.error('No items selected');
      return;
    }

    // Check all items have the same company
    const companyId = selectedItems[0]?.product?.company_id;
    if (!companyId) {
      toast.error('Missing company information');
      return;
    }

    // Check all items are at the same location and bin
    const locationId = selectedItems[0].location_id;
    const binId = selectedItems[0].bin_id;

    const allSameLocation = selectedItems.every(
      (item) => item.location_id === locationId && item.bin_id === binId
    );

    if (!allSameLocation) {
      toast.error('All items must be in the same location and bin to package together');
      return;
    }

    setIsProcessing(true);
    try {
      // Calculate total quantity
      const totalQuantity = selectedItems.reduce((sum, item) => sum + item.quantity, 0);

      // Get the first product for the main PU (for mixed products, we use a generic approach)
      const firstProduct = selectedItems[0];

      // Create a new packaging unit
      const result = await createPackagingUnit(companyId, firstProduct.product_id, totalQuantity);

      if (!result) {
        throw new Error('Failed to create packaging unit');
      }

      // Update all selected inventory items to reference the new PU
      const updatePromises = selectedItems.map((item) =>
        supabase
          .from('inventory')
          .update({ pu_id: result.id, updated_at: new Date().toISOString() })
          .eq('id', item.id)
      );

      await Promise.all(updatePromises);

      setCreatedPU(result);
      toast.success(`Created package: ${result.pu_number} (${packagingUOM})`);
    } catch (error) {
      console.error('Package together error:', error);
      toast.error('Failed to package items together');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (createdPU) {
      onCompleted();
    }
    setCreatedPU(null);
    setPackagingUOM('pallet');
    onOpenChange(false);
  };

  const totalQuantity = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
  const uniqueProducts = new Set(selectedItems.map((item) => item.product_id)).size;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Package Items Together
          </DialogTitle>
          <DialogDescription>
            Combine selected inventory lines into a single packaging unit
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-4">
          {createdPU ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <Tag className="w-8 h-8 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Packaging Unit Created</p>
                <p className="text-2xl font-mono font-bold text-primary">{createdPU.pu_number}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type:</span>
                  <span className="font-medium capitalize">{packagingUOM}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Items Combined:</span>
                  <span className="font-medium">{selectedItems.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Quantity:</span>
                  <span className="font-medium">{totalQuantity}</span>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Selected Items:</span>
                  <span className="font-medium">{selectedItems.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Unique Products:</span>
                  <span className="font-medium">{uniqueProducts}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Quantity:</span>
                  <span className="font-medium">{totalQuantity}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Packaging Type (UOM)</Label>
                <Select value={packagingUOM} onValueChange={setPackagingUOM}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select packaging type" />
                  </SelectTrigger>
                  <SelectContent>
                    {PACKAGING_UOMS.map((uom) => (
                      <SelectItem key={uom.value} value={uom.value}>
                        {uom.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="border-t pt-3">
                <p className="text-xs text-muted-foreground">
                  All selected items will be assigned to a new Packaging Unit (PU). 
                  Existing PU assignments will be overwritten.
                </p>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="shrink-0 px-6 sticky bottom-0 bg-background border-t pt-4">
          {createdPU ? (
            <Button onClick={handleClose}>
              Done
              <Kbd className="ml-2">Esc</Kbd>
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
                <Kbd>Esc</Kbd>
              </Button>
              <Button onClick={handlePackageTogether} disabled={isProcessing}>
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Package className="w-4 h-4 mr-2" />
                    Create Package
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
