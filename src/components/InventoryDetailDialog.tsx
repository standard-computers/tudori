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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Package, MapPin, Boxes, ArrowRight, Trash2, Tag, Split } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { createPackagingUnit, createMultiplePackagingUnits } from '@/lib/packaging-units';
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

interface Bin {
  id: string;
  bin_id: string;
  name: string;
}

interface InventoryDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: InventoryItem | null;
  locationId: string;
  onUpdated: () => void;
}

export const InventoryDetailDialog = ({
  open,
  onOpenChange,
  item,
  locationId,
  onUpdated,
}: InventoryDetailDialogProps) => {
  const [isPutAwayMode, setIsPutAwayMode] = useState(false);
  const [bins, setBins] = useState<Bin[]>([]);
  const [selectedBinId, setSelectedBinId] = useState<string>('');
  const [putAwayQuantity, setPutAwayQuantity] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAssigningPU, setIsAssigningPU] = useState(false);
  const [isExploding, setIsExploding] = useState(false);

  useEffect(() => {
    if (open && item) {
      setIsPutAwayMode(false);
      setPutAwayQuantity(item.quantity);
      setSelectedBinId('');
      fetchBins();
    }
  }, [open, item, locationId]);

  const fetchBins = async () => {
    // First get areas for this location
    const { data: areas } = await supabase
      .from('areas')
      .select('id')
      .eq('location_id', locationId);

    if (!areas || areas.length === 0) {
      setBins([]);
      return;
    }

    const areaIds = areas.map(a => a.id);

    // Then get bins for those areas
    const { data: binsData } = await supabase
      .from('bins')
      .select('id, bin_id, name')
      .in('area_id', areaIds)
      .order('bin_id');

    setBins(binsData || []);
  };

  const handlePutAway = async () => {
    if (!item || !selectedBinId) {
      toast.error('Please select a bin');
      return;
    }

    if (putAwayQuantity <= 0 || putAwayQuantity > item.quantity) {
      toast.error('Invalid quantity');
      return;
    }

    setIsLoading(true);

    try {
      // Check if there's already inventory in the target bin for this product
      const { data: existingBinInventory } = await supabase
        .from('inventory')
        .select('id, quantity')
        .eq('location_id', locationId)
        .eq('product_id', item.product_id)
        .eq('bin_id', selectedBinId)
        .maybeSingle();

      if (existingBinInventory) {
        // Add to existing bin inventory
        await supabase
          .from('inventory')
          .update({
            quantity: existingBinInventory.quantity + putAwayQuantity,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingBinInventory.id);
      } else {
        // Create new inventory record in the bin
        await supabase.from('inventory').insert({
          location_id: locationId,
          product_id: item.product_id,
          bin_id: selectedBinId,
          quantity: putAwayQuantity,
          min_quantity: item.min_quantity,
          max_quantity: item.max_quantity,
        });
      }

      // Update or delete the source (unassigned) inventory
      const remainingQuantity = item.quantity - putAwayQuantity;
      if (remainingQuantity > 0) {
        await supabase
          .from('inventory')
          .update({
            quantity: remainingQuantity,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id);
      } else {
        // Delete the source record if all was put away
        await supabase.from('inventory').delete().eq('id', item.id);
      }

      const selectedBin = bins.find(b => b.id === selectedBinId);
      toast.success(`Put away ${putAwayQuantity} units to ${selectedBin?.bin_id || 'bin'}`);
      onUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error('Put away error:', error);
      toast.error('Failed to put away inventory');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!item) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('inventory')
        .delete()
        .eq('id', item.id);

      if (error) throw error;

      toast.success('Inventory deleted successfully');
      onUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete inventory');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAssignPU = async () => {
    if (!item || !item.product?.company_id) {
      toast.error('Missing product or company information');
      return;
    }

    setIsAssigningPU(true);
    try {
      const result = await createPackagingUnit(
        item.product.company_id,
        item.product_id,
        item.quantity
      );

      if (!result) {
        throw new Error('Failed to generate PU number');
      }

      // Update the inventory record with the new PU
      const { error } = await supabase
        .from('inventory')
        .update({ pu_id: result.id, updated_at: new Date().toISOString() })
        .eq('id', item.id);

      if (error) throw error;

      toast.success(`Assigned PU: ${result.pu_number}`);
      onUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error('Assign PU error:', error);
      toast.error('Failed to assign PU');
    } finally {
      setIsAssigningPU(false);
    }
  };

  const handleExplode = async () => {
    if (!item || !item.product?.company_id) {
      toast.error('Missing product or company information');
      return;
    }

    if (item.quantity <= 1) {
      toast.error('Quantity must be greater than 1 to explode');
      return;
    }

    setIsExploding(true);
    try {
      // Create individual PUs for each unit
      const items = Array.from({ length: item.quantity }, () => ({
        productId: item.product_id,
        quantity: 1,
      }));

      const createdPUs = await createMultiplePackagingUnits(item.product.company_id, items);

      if (createdPUs.length === 0) {
        throw new Error('Failed to create packaging units');
      }

      // Delete the original inventory record
      await supabase.from('inventory').delete().eq('id', item.id);

      // Create new individual inventory records
      const inventoryRecords = createdPUs.map((pu) => ({
        location_id: item.location_id,
        product_id: item.product_id,
        bin_id: item.bin_id,
        quantity: 1,
        min_quantity: item.min_quantity,
        max_quantity: item.max_quantity,
        pu_id: pu.id,
      }));

      const { error } = await supabase.from('inventory').insert(inventoryRecords);

      if (error) throw error;

      toast.success(`Exploded into ${createdPUs.length} individual units with PUs`);
      onUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error('Explode error:', error);
      toast.error('Failed to explode inventory');
    } finally {
      setIsExploding(false);
    }
  };

  if (!item) return null;

  const canPutAway = !item.bin_id;
  const hasPU = !!item.pu_id;
  const canExplode = item.quantity > 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            {isPutAwayMode ? 'Put Away Inventory' : 'Inventory Details'}
          </DialogTitle>
          <DialogDescription>
            {isPutAwayMode
              ? 'Confirm quantity and select destination bin'
              : 'View inventory item details'}
          </DialogDescription>
        </DialogHeader>

        {!isPutAwayMode ? (
          <div className="space-y-4 px-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Product ID</Label>
                <p className="font-mono text-sm">{item.product?.product_id || '—'}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">SKU</Label>
                <p className="font-mono text-sm">{item.product?.sku || '—'}</p>
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Product Name</Label>
              <p className="text-sm font-medium">{item.product?.name || 'Unknown'}</p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Quantity</Label>
                <p className="text-lg font-semibold">{item.quantity}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Min Qty</Label>
                <p className="text-sm">{item.min_quantity ?? '—'}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Max Qty</Label>
                <p className="text-sm">{item.max_quantity ?? '—'}</p>
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">PU #</Label>
              <div className="flex items-center gap-2 mt-1">
                <Tag className="w-4 h-4 text-muted-foreground" />
                {item.packaging_unit?.pu_number ? (
                  <span className="font-mono text-sm">{item.packaging_unit.pu_number}</span>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">Not assigned</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAssignPU}
                      disabled={isAssigningPU}
                    >
                      <Tag className="w-3 h-3 mr-1" />
                      {isAssigningPU ? 'Assigning...' : 'Assign PU'}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Bin Location</Label>
              <div className="flex items-center gap-2 mt-1">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                {item.bin ? (
                  <span className="font-mono text-sm">
                    {item.bin.bin_id} - {item.bin.name}
                  </span>
                ) : (
                  <span className="text-amber-600 text-sm font-medium">Unassigned</span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 px-6 py-4">
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Package className="w-4 h-4" />
                <span className="font-medium">{item.product?.name}</span>
              </div>
              <p className="text-xs text-muted-foreground font-mono">
                {item.product?.product_id} {item.product?.sku && `• ${item.product.sku}`}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="put-away-qty">Quantity to Put Away</Label>
              <Input
                id="put-away-qty"
                type="number"
                min={1}
                max={item.quantity}
                value={putAwayQuantity}
                onChange={(e) => setPutAwayQuantity(parseInt(e.target.value) || 0)}
                className="text-lg font-medium"
              />
              <p className="text-xs text-muted-foreground">
                Available: {item.quantity} units
              </p>
            </div>

            <div className="space-y-2">
              <Label>Destination Bin</Label>
              {bins.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  No bins available. Create bins in the Bins tab first.
                </p>
              ) : (
                <Select value={selectedBinId} onValueChange={setSelectedBinId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a bin" />
                  </SelectTrigger>
                  <SelectContent>
                    {bins.map((bin) => (
                      <SelectItem key={bin.id} value={bin.id}>
                        {bin.bin_id} - {bin.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {!isPutAwayMode ? (
            <>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={isDeleting}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Inventory</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete {item.quantity} units of {item.product?.name}? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      {isDeleting ? 'Deleting...' : 'Delete'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <div className="flex-1" />
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
                <Kbd>Esc</Kbd>
              </Button>
              {canExplode && (
                <Button 
                  variant="secondary" 
                  onClick={handleExplode} 
                  disabled={isExploding}
                >
                  <Split className="w-4 h-4 mr-2" />
                  {isExploding ? 'Exploding...' : 'Explode'}
                </Button>
              )}
              {canPutAway && (
                <Button onClick={() => setIsPutAwayMode(true)} disabled={bins.length === 0}>
                  <Boxes className="w-4 h-4 mr-2" />
                  Put Away
                </Button>
              )}
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setIsPutAwayMode(false)}>
                Back
              </Button>
              <Button
                onClick={handlePutAway}
                disabled={isLoading || !selectedBinId || putAwayQuantity <= 0}
              >
                <ArrowRight className="w-4 h-4 mr-2" />
                {isLoading ? 'Processing...' : 'Confirm Put Away'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
