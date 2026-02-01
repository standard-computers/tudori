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
import { Package, MapPin, Boxes, ArrowRight, Trash2, Tag, Split, Wand2, Loader2, MoveRight, Replace } from 'lucide-react';
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
  allow_picking: boolean;
  allow_put_away: boolean;
  allow_auto_put_away: boolean;
}

interface InventoryDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: InventoryItem | null;
  locationId: string;
  onUpdated: () => void;
}

interface PackagingUnitOption {
  id: string;
  pu_number: string;
  product_name?: string;
}

export const InventoryDetailDialog = ({
  open,
  onOpenChange,
  item,
  locationId,
  onUpdated,
}: InventoryDetailDialogProps) => {
  const [isPutAwayMode, setIsPutAwayMode] = useState(false);
  const [isMoveMode, setIsMoveMode] = useState(false);
  const [isChangePUMode, setIsChangePUMode] = useState(false);
  const [bins, setBins] = useState<Bin[]>([]);
  const [selectedBinId, setSelectedBinId] = useState<string>('');
  const [putAwayQuantity, setPutAwayQuantity] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAssigningPU, setIsAssigningPU] = useState(false);
  const [isExploding, setIsExploding] = useState(false);
  const [isAutoAssigning, setIsAutoAssigning] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [isChangingPU, setIsChangingPU] = useState(false);
  const [siblingPUItems, setSiblingPUItems] = useState<InventoryItem[]>([]);
  const [showPUConfirmDialog, setShowPUConfirmDialog] = useState(false);
  const [pendingMoveAction, setPendingMoveAction] = useState<'manual' | 'auto' | 'move' | null>(null);
  const [availablePUs, setAvailablePUs] = useState<PackagingUnitOption[]>([]);
  const [selectedPUId, setSelectedPUId] = useState<string>('');

  useEffect(() => {
    if (open && item) {
      setIsPutAwayMode(false);
      setIsMoveMode(false);
      setIsChangePUMode(false);
      setPutAwayQuantity(item.quantity);
      setSelectedBinId('');
      setSelectedPUId('');
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
      .select('id, bin_id, name, allow_picking, allow_put_away, allow_auto_put_away')
      .in('area_id', areaIds)
      .order('bin_id');

    setBins(binsData || []);
  };

  const fetchAvailablePUs = async () => {
    if (!item?.product?.company_id) return;
    
    // Fetch PUs for this company (optionally filter by same product or show all)
    const { data: pus } = await supabase
      .from('packaging_units')
      .select(`
        id, 
        pu_number, 
        product:products(name)
      `)
      .eq('company_id', item.product.company_id)
      .eq('status', 'active')
      .order('pu_number');
    
    const options: PackagingUnitOption[] = (pus || []).map((pu: any) => ({
      id: pu.id,
      pu_number: pu.pu_number,
      product_name: pu.product?.name,
    }));
    
    setAvailablePUs(options);
  };

  const handleInitiateChangePU = async () => {
    if (!item) return;
    await fetchAvailablePUs();
    setIsChangePUMode(true);
  };

  const handleChangePU = async () => {
    if (!item) return;
    
    setIsChangingPU(true);
    try {
      // selectedPUId can be 'new' for creating a new PU, or an existing PU id
      let newPUId: string | null = null;
      
      if (selectedPUId === 'new') {
        // Create a new PU
        if (!item.product?.company_id) {
          throw new Error('Missing company information');
        }
        const result = await createPackagingUnit(
          item.product.company_id,
          item.product_id,
          item.quantity
        );
        if (!result) {
          throw new Error('Failed to create packaging unit');
        }
        newPUId = result.id;
        toast.success(`Created and assigned new PU: ${result.pu_number}`);
      } else if (selectedPUId === 'none') {
        // Remove PU assignment
        newPUId = null;
        toast.success('Removed PU assignment');
      } else {
        // Assign existing PU
        newPUId = selectedPUId;
        const selectedPU = availablePUs.find(p => p.id === selectedPUId);
        toast.success(`Changed PU to: ${selectedPU?.pu_number}`);
      }
      
      // Update the inventory record with the new PU
      const { error } = await supabase
        .from('inventory')
        .update({ pu_id: newPUId, updated_at: new Date().toISOString() })
        .eq('id', item.id);

      if (error) throw error;

      onUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error('Change PU error:', error);
      toast.error('Failed to change PU');
    } finally {
      setIsChangingPU(false);
    }
  };

  // Check for sibling inventory items that share the same PU
  const checkSiblingPUItems = async (): Promise<InventoryItem[]> => {
    if (!item?.pu_id) return [];
    
    const { data: siblings } = await supabase
      .from('inventory')
      .select(`
        id, location_id, bin_id, product_id, pu_id, quantity, min_quantity, max_quantity,
        product:products(name, product_id, sku, company_id),
        bin:bins(bin_id, name),
        packaging_unit:packaging_units(pu_number)
      `)
      .eq('pu_id', item.pu_id)
      .neq('id', item.id);
    
    return (siblings || []) as unknown as InventoryItem[];
  };

  const handleInitiatePutAway = async () => {
    if (!item) return;
    
    // Check for siblings with same PU
    if (item.pu_id) {
      const siblings = await checkSiblingPUItems();
      if (siblings.length > 0) {
        setSiblingPUItems(siblings);
        setPendingMoveAction('manual');
        setShowPUConfirmDialog(true);
        return;
      }
    }
    
    setIsPutAwayMode(true);
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
      // Get all items to move (current item + siblings if they share PU)
      const itemsToMove = siblingPUItems.length > 0 
        ? [item, ...siblingPUItems] 
        : [item];

      for (const invItem of itemsToMove) {
        const moveQuantity = invItem.id === item.id ? putAwayQuantity : invItem.quantity;
        
        // Check if there's already inventory in the target bin for this product WITH the same PU
        // Only combine if both product_id and pu_id match to preserve separate packaging units
        let query = supabase
          .from('inventory')
          .select('id, quantity')
          .eq('location_id', locationId)
          .eq('product_id', invItem.product_id)
          .eq('bin_id', selectedBinId);
        
        // Match on pu_id - only combine if PUs are the same
        if (invItem.pu_id) {
          query = query.eq('pu_id', invItem.pu_id);
        } else {
          query = query.is('pu_id', null);
        }
        
        const { data: existingBinInventory } = await query.maybeSingle();

        if (existingBinInventory) {
          // Add to existing bin inventory (same product AND same PU)
          await supabase
            .from('inventory')
            .update({
              quantity: existingBinInventory.quantity + moveQuantity,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingBinInventory.id);
        } else {
          // Create new inventory record in the bin (different PU or no matching record)
          await supabase.from('inventory').insert({
            location_id: locationId,
            product_id: invItem.product_id,
            bin_id: selectedBinId,
            quantity: moveQuantity,
            min_quantity: invItem.min_quantity,
            max_quantity: invItem.max_quantity,
            pu_id: invItem.pu_id,
          });
        }

        // Update or delete the source inventory
        const remainingQuantity = invItem.quantity - moveQuantity;
        if (remainingQuantity > 0) {
          await supabase
            .from('inventory')
            .update({
              quantity: remainingQuantity,
              updated_at: new Date().toISOString(),
            })
            .eq('id', invItem.id);
        } else {
          await supabase.from('inventory').delete().eq('id', invItem.id);
        }
      }

      const selectedBin = bins.find(b => b.id === selectedBinId);
      const totalItems = siblingPUItems.length > 0 ? itemsToMove.length : 1;
      toast.success(
        `Put away ${totalItems > 1 ? `${totalItems} items (PU)` : `${putAwayQuantity} units`} to ${selectedBin?.bin_id || 'bin'}`
      );
      setSiblingPUItems([]);
      onUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error('Put away error:', error);
      toast.error('Failed to put away inventory');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInitiateAutoPutAway = async () => {
    if (!item) return;
    
    // Check for siblings with same PU
    if (item.pu_id) {
      const siblings = await checkSiblingPUItems();
      if (siblings.length > 0) {
        setSiblingPUItems(siblings);
        setPendingMoveAction('auto');
        setShowPUConfirmDialog(true);
        return;
      }
    }
    
    await handleAutoPutAway();
  };

  const handleAutoPutAway = async () => {
    if (!item) return;
    
    setIsAutoAssigning(true);
    
    try {
      let targetBinId: string | null = null;
      
      // Step 1: Check bin_products for bins that explicitly list this product
      const { data: binProducts } = await supabase
        .from('bin_products')
        .select('bin_id')
        .eq('product_id', item.product_id);
      
      // Filter bins to only those that allow auto put away
      const autoEligibleBins = bins.filter(b => b.allow_auto_put_away);
      
      if (binProducts && binProducts.length > 0) {
        // Find the first bin that's in our available bins list at this location AND allows auto put away
        for (const bp of binProducts) {
          const matchingBin = autoEligibleBins.find(b => b.id === bp.bin_id);
          if (matchingBin) {
            targetBinId = matchingBin.id;
            break;
          }
        }
      }
      
      // Step 2: If no bin_product match, find the first empty bin (no inventory at all) that allows auto put away
      if (!targetBinId && autoEligibleBins.length > 0) {
        // Get all bins that have any inventory at this location
        const { data: binsWithInventory } = await supabase
          .from('inventory')
          .select('bin_id')
          .eq('location_id', locationId)
          .not('bin_id', 'is', null);
        
        const occupiedBinIds = new Set(
          (binsWithInventory || []).map(inv => inv.bin_id).filter(Boolean)
        );
        
        // Find first bin that has no inventory and allows auto put away
        const emptyBin = autoEligibleBins.find(b => !occupiedBinIds.has(b.id));
        if (emptyBin) {
          targetBinId = emptyBin.id;
        }
      }
      
      if (!targetBinId) {
        toast.error('No suitable bin found. Either assign this product to a bin or ensure there is an empty bin available.');
        return;
      }
      
      const selectedBin = bins.find(b => b.id === targetBinId);
      
      // Get all items to move (current item + siblings if they share PU)
      const itemsToMove = siblingPUItems.length > 0 
        ? [item, ...siblingPUItems] 
        : [item];

      for (const invItem of itemsToMove) {
        // Check if there's already inventory in the target bin for this product WITH the same PU
        // Only combine if both product_id and pu_id match to preserve separate packaging units
        let query = supabase
          .from('inventory')
          .select('id, quantity')
          .eq('location_id', locationId)
          .eq('product_id', invItem.product_id)
          .eq('bin_id', targetBinId);
        
        // Match on pu_id - only combine if PUs are the same
        if (invItem.pu_id) {
          query = query.eq('pu_id', invItem.pu_id);
        } else {
          query = query.is('pu_id', null);
        }
        
        const { data: existingBinInventory } = await query.maybeSingle();

        if (existingBinInventory) {
          // Add to existing bin inventory (same product AND same PU)
          await supabase
            .from('inventory')
            .update({
              quantity: existingBinInventory.quantity + invItem.quantity,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingBinInventory.id);
        } else {
          // Create new inventory record in the bin (different PU or no matching record)
          await supabase.from('inventory').insert({
            location_id: locationId,
            product_id: invItem.product_id,
            bin_id: targetBinId,
            quantity: invItem.quantity,
            min_quantity: invItem.min_quantity,
            max_quantity: invItem.max_quantity,
            pu_id: invItem.pu_id,
          });
        }

        // Delete the source inventory
        await supabase.from('inventory').delete().eq('id', invItem.id);
      }

      const totalItems = siblingPUItems.length > 0 ? itemsToMove.length : 1;
      toast.success(
        `Auto put away ${totalItems > 1 ? `${totalItems} items (PU)` : `${item.quantity} units`} to ${selectedBin?.bin_id || 'bin'}`
      );
      setSiblingPUItems([]);
      onUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error('Auto put away error:', error);
      toast.error('Failed to auto put away');
    } finally {
      setIsAutoAssigning(false);
    }
  };

  const handlePUConfirmContinue = () => {
    setShowPUConfirmDialog(false);
    if (pendingMoveAction === 'manual') {
      setIsPutAwayMode(true);
    } else if (pendingMoveAction === 'auto') {
      handleAutoPutAway();
    } else if (pendingMoveAction === 'move') {
      setIsMoveMode(true);
    }
    setPendingMoveAction(null);
  };

  const handlePUConfirmCancel = () => {
    setShowPUConfirmDialog(false);
    setSiblingPUItems([]);
    setPendingMoveAction(null);
  };

  const handleInitiateMove = async () => {
    if (!item) return;
    
    // Check for siblings with same PU
    if (item.pu_id) {
      const siblings = await checkSiblingPUItems();
      if (siblings.length > 0) {
        setSiblingPUItems(siblings);
        setPendingMoveAction('move');
        setShowPUConfirmDialog(true);
        return;
      }
    }
    
    setIsMoveMode(true);
  };

  const handleMove = async () => {
    if (!item || !selectedBinId) {
      toast.error('Please select a destination bin');
      return;
    }

    if (putAwayQuantity <= 0 || putAwayQuantity > item.quantity) {
      toast.error('Invalid quantity');
      return;
    }

    setIsMoving(true);

    try {
      // Get all items to move (current item + siblings if they share PU)
      const itemsToMove = siblingPUItems.length > 0 
        ? [item, ...siblingPUItems] 
        : [item];

      for (const invItem of itemsToMove) {
        const moveQuantity = invItem.id === item.id ? putAwayQuantity : invItem.quantity;
        
        // Check if there's already inventory in the target bin for this product WITH the same PU
        // Only combine if both product_id and pu_id match to preserve separate packaging units
        let query = supabase
          .from('inventory')
          .select('id, quantity')
          .eq('location_id', locationId)
          .eq('product_id', invItem.product_id)
          .eq('bin_id', selectedBinId);
        
        // Match on pu_id - only combine if PUs are the same
        if (invItem.pu_id) {
          query = query.eq('pu_id', invItem.pu_id);
        } else {
          query = query.is('pu_id', null);
        }
        
        const { data: existingBinInventory } = await query.maybeSingle();

        if (existingBinInventory) {
          // Add to existing bin inventory (same product AND same PU)
          await supabase
            .from('inventory')
            .update({
              quantity: existingBinInventory.quantity + moveQuantity,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingBinInventory.id);
        } else {
          // Create new inventory record in the bin (different PU or no matching record)
          await supabase.from('inventory').insert({
            location_id: locationId,
            product_id: invItem.product_id,
            bin_id: selectedBinId,
            quantity: moveQuantity,
            min_quantity: invItem.min_quantity,
            max_quantity: invItem.max_quantity,
            pu_id: invItem.pu_id,
          });
        }

        // Update or delete the source inventory
        const remainingQuantity = invItem.quantity - moveQuantity;
        if (remainingQuantity > 0) {
          await supabase
            .from('inventory')
            .update({
              quantity: remainingQuantity,
              updated_at: new Date().toISOString(),
            })
            .eq('id', invItem.id);
        } else {
          await supabase.from('inventory').delete().eq('id', invItem.id);
        }
      }

      const selectedBin = bins.find(b => b.id === selectedBinId);
      const totalItems = siblingPUItems.length > 0 ? itemsToMove.length : 1;
      toast.success(
        `Moved ${totalItems > 1 ? `${totalItems} items (PU)` : `${putAwayQuantity} units`} to ${selectedBin?.bin_id || 'bin'}`
      );
      setSiblingPUItems([]);
      onUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error('Move error:', error);
      toast.error('Failed to move inventory');
    } finally {
      setIsMoving(false);
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
      const hasExistingPU = !!item.pu_id;
      const newPUsNeeded = hasExistingPU ? item.quantity - 1 : item.quantity;

      // Create PUs only for items that need them
      const itemsForPU = Array.from({ length: newPUsNeeded }, () => ({
        productId: item.product_id,
        quantity: 1,
      }));

      const createdPUs = newPUsNeeded > 0
        ? await createMultiplePackagingUnits(item.product.company_id, itemsForPU)
        : [];

      if (newPUsNeeded > 0 && createdPUs.length === 0) {
        throw new Error('Failed to create packaging units');
      }

      // Update the original record to quantity 1 (keeping existing PU if present)
      await supabase
        .from('inventory')
        .update({ quantity: 1 })
        .eq('id', item.id);

      // Create new individual inventory records for remaining units
      if (createdPUs.length > 0) {
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
      }

      toast.success(`Exploded into ${item.quantity} individual units${hasExistingPU ? ' (kept existing PU on first)' : ''}`);
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
  
  // Check if current bin allows picking (for Move button)
  const currentBin = item.bin_id ? bins.find(b => b.id === item.bin_id) : null;
  const canMove = !!item.bin_id && (currentBin?.allow_picking ?? true);
  
  // Filter bins for move mode - only show bins with put away enabled
  const availableBinsForMove = bins.filter(b => b.allow_put_away && b.id !== item.bin_id);
  const binsToShow = isMoveMode ? availableBinsForMove : bins;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            {isChangePUMode ? 'Change Packaging Unit' : isMoveMode ? 'Move Inventory' : isPutAwayMode ? 'Put Away Inventory' : 'Inventory Details'}
          </DialogTitle>
          <DialogDescription>
            {isChangePUMode
              ? 'Select a new packaging unit for this inventory'
              : isMoveMode
              ? 'Select destination bin for this inventory'
              : isPutAwayMode
              ? 'Confirm quantity and select destination bin'
              : 'View inventory item details'}
          </DialogDescription>
        </DialogHeader>

        {isChangePUMode ? (
          <div className="space-y-4 px-6 py-4">
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Package className="w-4 h-4" />
                <span className="font-medium">{item.product?.name}</span>
              </div>
              <p className="text-xs text-muted-foreground font-mono">
                {item.product?.product_id} {item.product?.sku && `• ${item.product.sku}`}
              </p>
              {item.packaging_unit?.pu_number && (
                <p className="text-xs text-muted-foreground mt-1">
                  Current PU: <span className="font-mono">{item.packaging_unit.pu_number}</span>
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>New Packaging Unit</Label>
              <Select value={selectedPUId} onValueChange={setSelectedPUId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a packaging unit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">
                    <span className="flex items-center gap-2">
                      <Tag className="w-3 h-3" />
                      Create New PU
                    </span>
                  </SelectItem>
                  {item.pu_id && (
                    <SelectItem value="none">
                      <span className="text-muted-foreground">Remove PU Assignment</span>
                    </SelectItem>
                  )}
                  {availablePUs
                    .filter(pu => pu.id !== item.pu_id)
                    .map((pu) => (
                      <SelectItem key={pu.id} value={pu.id}>
                        <span className="font-mono">{pu.pu_number}</span>
                        {pu.product_name && (
                          <span className="text-muted-foreground ml-2">({pu.product_name})</span>
                        )}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Select an existing PU, create a new one, or remove the current assignment.
              </p>
            </div>
          </div>
        ) : !isPutAwayMode && !isMoveMode ? (
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

            {siblingPUItems.length > 0 && (
              <div className="p-3 border border-primary/30 bg-primary/5 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Tag className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">
                    Moving entire PU: {item.packaging_unit?.pu_number}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {siblingPUItems.length + 1} items will be moved together
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="put-away-qty">Quantity to {isMoveMode ? 'Move' : 'Put Away'}</Label>
              <Input
                id="put-away-qty"
                type="number"
                min={1}
                max={item.quantity}
                value={putAwayQuantity}
                onChange={(e) => setPutAwayQuantity(parseInt(e.target.value) || 0)}
                className="text-lg font-medium"
                disabled={siblingPUItems.length > 0}
              />
              <p className="text-xs text-muted-foreground">
                {siblingPUItems.length > 0 
                  ? 'Full quantity will be moved with the packaging unit'
                  : `Available: ${item.quantity} units`}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Destination Bin</Label>
                {bins.length > 0 && !isMoveMode && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleInitiateAutoPutAway}
                    disabled={isAutoAssigning}
                    className="h-7"
                  >
                    {isAutoAssigning ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <Wand2 className="w-3 h-3 mr-1" />
                    )}
                    Auto
                  </Button>
                )}
              </div>
              {binsToShow.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  {isMoveMode 
                    ? 'No bins with put away enabled available.'
                    : 'No bins available. Create bins in the Bins tab first.'}
                </p>
              ) : (
                <Select value={selectedBinId} onValueChange={setSelectedBinId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a bin" />
                  </SelectTrigger>
                  <SelectContent>
                    {binsToShow.map((bin) => (
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
          {!isPutAwayMode && !isMoveMode && !isChangePUMode ? (
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
              {item.bin_id && (
                <Button 
                  variant="secondary" 
                  onClick={handleInitiateMove} 
                  disabled={!canMove || availableBinsForMove.length === 0}
                  title={!canMove ? 'Current bin does not allow picking' : undefined}
                >
                  <MoveRight className="w-4 h-4 mr-2" />
                  Move
                </Button>
              )}
              <Button 
                variant="secondary" 
                onClick={handleInitiateChangePU}
              >
                <Replace className="w-4 h-4 mr-2" />
                Change PU
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
                <Button onClick={handleInitiatePutAway} disabled={bins.length === 0}>
                  <Boxes className="w-4 h-4 mr-2" />
                  Put Away
                </Button>
              )}
            </>
          ) : isChangePUMode ? (
            <>
              <Button variant="outline" onClick={() => setIsChangePUMode(false)}>
                Back
              </Button>
              <Button
                onClick={handleChangePU}
                disabled={isChangingPU || !selectedPUId}
              >
                <Replace className="w-4 h-4 mr-2" />
                {isChangingPU ? 'Changing...' : 'Confirm Change'}
              </Button>
            </>
          ) : isMoveMode ? (
            <>
              <Button variant="outline" onClick={() => { setIsMoveMode(false); setSiblingPUItems([]); }}>
                Back
              </Button>
              <Button
                onClick={handleMove}
                disabled={isMoving || !selectedBinId || putAwayQuantity <= 0}
              >
                <MoveRight className="w-4 h-4 mr-2" />
                {isMoving ? 'Moving...' : 'Confirm Move'}
              </Button>
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

      {/* PU Confirmation Dialog */}
      <AlertDialog open={showPUConfirmDialog} onOpenChange={setShowPUConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Move Entire Packaging Unit?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  This item is part of packaging unit <strong className="font-mono">{item.packaging_unit?.pu_number}</strong> which contains {siblingPUItems.length + 1} inventory lines.
                </p>
                <p>All items in this packaging unit will be moved together:</p>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  <li>
                    {item.product?.name} - {item.quantity} units
                  </li>
                  {siblingPUItems.map((sibling) => (
                    <li key={sibling.id}>
                      {sibling.product?.name || 'Unknown'} - {sibling.quantity} units
                    </li>
                  ))}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handlePUConfirmCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handlePUConfirmContinue}>
              Move Packaging Unit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};
