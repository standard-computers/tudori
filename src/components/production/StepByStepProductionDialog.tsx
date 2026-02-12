import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Check, X, AlertTriangle, ChevronRight, MapPin, Clock, Package, Maximize2, Minimize2 } from 'lucide-react';
import { toast } from '@/lib/toast';

interface BomStep {
  id: string;
  step_number: number;
  name: string;
  description: string | null;
  estimated_duration_minutes: number | null;
  location_id: string | null;
  bin_id: string | null;
  location?: { name: string; location_id: string } | null;
  bin?: { name: string; bin_id: string } | null;
}

interface BomStepItem {
  id: string;
  bom_step_id: string;
  product_id: string;
  quantity: number;
  product?: { name: string; product_id: string };
}

interface InventoryRecord {
  id: string;
  product_id: string;
  quantity: number;
  bin_id: string | null;
}

interface StepByStepProductionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber: string;
  bomId: string;
  locationId: string;
  quantity: number; // Number of batches
  companyId: string;
  onComplete: () => void;
  initialCompletedStepIds?: string[]; // For resuming from where left off
}

export function StepByStepProductionDialog({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  bomId,
  locationId,
  quantity,
  companyId,
  onComplete,
  initialCompletedStepIds = [],
}: StepByStepProductionDialogProps) {
  const [steps, setSteps] = useState<BomStep[]>([]);
  const [isMaximized, setIsMaximized] = useState(false);
  const [stepItems, setStepItems] = useState<Record<string, BomStepItem[]>>({});
  const [binInventory, setBinInventory] = useState<Record<string, InventoryRecord[]>>({});
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const currentStep = steps[currentStepIndex];
  const progress = steps.length > 0 ? (completedSteps.size / steps.length) * 100 : 0;

  // Fetch steps and their items when dialog opens
  useEffect(() => {
    if (open && bomId) {
      fetchStepsAndItems();
    } else {
      // Reset state when dialog closes
      setSteps([]);
      setStepItems({});
      setBinInventory({});
      setCurrentStepIndex(0);
      setCompletedSteps(new Set());
    }
  }, [open, bomId]);

  // Load completed steps from database when opening
  useEffect(() => {
    if (open && orderId) {
      loadCompletedSteps();
    }
  }, [open, orderId]);

  const loadCompletedSteps = async () => {
    const { data } = await supabase
      .from('production_orders')
      .select('completed_step_ids')
      .eq('id', orderId)
      .single();
    
    if (data?.completed_step_ids && data.completed_step_ids.length > 0) {
      setCompletedSteps(new Set(data.completed_step_ids));
    } else if (initialCompletedStepIds.length > 0) {
      setCompletedSteps(new Set(initialCompletedStepIds));
    }
  };

  // Find first incomplete step when steps load
  useEffect(() => {
    if (steps.length > 0 && completedSteps.size > 0) {
      const firstIncompleteIndex = steps.findIndex(s => !completedSteps.has(s.id));
      if (firstIncompleteIndex !== -1 && firstIncompleteIndex !== currentStepIndex) {
        setCurrentStepIndex(firstIncompleteIndex);
      }
    }
  }, [steps, completedSteps]);

  const saveCompletedSteps = async (stepIds: string[]) => {
    await supabase
      .from('production_orders')
      .update({ completed_step_ids: stepIds })
      .eq('id', orderId);
  };

  // Perform goods receipt for finished goods when production completes
  const performFinishedGoodsReceipt = async () => {
    // Get BOM details to find output product and quantity
    const { data: bom } = await supabase
      .from('bill_of_materials')
      .select('product_id, output_quantity')
      .eq('id', bomId)
      .single();

    if (!bom) {
      throw new Error('Failed to load BOM details');
    }

    // Get the product price for ledger transaction
    const { data: product } = await supabase
      .from('products')
      .select('id, price, product_id, name')
      .eq('id', bom.product_id)
      .single();

    if (!product) {
      throw new Error('Failed to load product details');
    }

    // Calculate total output quantity (BOM output * batches)
    const totalOutputQty = bom.output_quantity * quantity;
    const unitPrice = product.price || 0;
    const totalValue = totalOutputQty * unitPrice;

    // Get the final step's bin for inventory placement
    const finalStep = steps[steps.length - 1];
    const targetBinId = finalStep?.bin_id || null;

    // Generate goods receipt number
    const { data: grConfig } = await supabase
      .from('document_id_config')
      .select('prefix, num_digits, starting_number')
      .eq('company_id', companyId)
      .eq('document_type', 'goods_receipt')
      .single();

    const { count: grCount } = await supabase
      .from('goods_receipts')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId);

    const grNumber = grConfig
      ? `${grConfig.prefix || ''}${String((grConfig.starting_number || 1) + (grCount || 0)).padStart(grConfig.num_digits || 4, '0')}`
      : `GR-${String((grCount || 0) + 1).padStart(4, '0')}`;

    // Create goods receipt
    const { data: goodsReceipt, error: grError } = await supabase
      .from('goods_receipts')
      .insert({
        receipt_number: grNumber,
        company_id: companyId,
        location_id: locationId,
        status: 'posted',
        notes: `Production output from ${orderNumber}`,
      })
      .select('id')
      .single();

    if (grError || !goodsReceipt) {
      throw new Error('Failed to create goods receipt');
    }

    // Create goods receipt item
    await supabase
      .from('goods_receipt_items')
      .insert({
        goods_receipt_id: goodsReceipt.id,
        product_id: bom.product_id,
        quantity: totalOutputQty,
        bin_id: targetBinId,
        notes: `Finished goods from production order ${orderNumber}`,
      });

    // Add to inventory
    if (targetBinId) {
      // Check if inventory record exists for this product/bin
      const { data: existingInv } = await supabase
        .from('inventory')
        .select('id, quantity')
        .eq('product_id', bom.product_id)
        .eq('bin_id', targetBinId)
        .eq('location_id', locationId)
        .single();

      if (existingInv) {
        await supabase
          .from('inventory')
          .update({ 
            quantity: existingInv.quantity + totalOutputQty,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingInv.id);
      } else {
        await supabase
          .from('inventory')
          .insert({
            product_id: bom.product_id,
            location_id: locationId,
            bin_id: targetBinId,
            quantity: totalOutputQty,
          });
      }
    } else {
      // No bin - add to location inventory without bin
      const { data: existingInv } = await supabase
        .from('inventory')
        .select('id, quantity')
        .eq('product_id', bom.product_id)
        .eq('location_id', locationId)
        .is('bin_id', null)
        .single();

      if (existingInv) {
        await supabase
          .from('inventory')
          .update({ 
            quantity: existingInv.quantity + totalOutputQty,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingInv.id);
      } else {
        await supabase
          .from('inventory')
          .insert({
            product_id: bom.product_id,
            location_id: locationId,
            quantity: totalOutputQty,
          });
      }
    }

    // Create positive ledger transaction for finished goods value
    const { data: ledger } = await supabase
      .from('ledgers')
      .select('id')
      .eq('location_id', locationId)
      .eq('is_active', true)
      .limit(1)
      .single();

    if (ledger && totalValue > 0) {
      await supabase
        .from('ledger_transactions')
        .insert({
          ledger_id: ledger.id,
          transaction_type: 'production_output',
          reference_id: orderId,
          reference_number: orderNumber,
          amount: totalValue,
          description: `Production output: ${product.name} x${totalOutputQty} from ${orderNumber}`,
          transaction_date: new Date().toISOString(),
        });
    }
  };

  // Fetch bin inventory when current step changes
  useEffect(() => {
    if (currentStep?.bin_id) {
      fetchBinInventory(currentStep.bin_id);
    }
  }, [currentStep?.bin_id]);

  const fetchStepsAndItems = async () => {
    setIsLoading(true);
    try {
      // Fetch steps
      const { data: stepsData, error: stepsError } = await supabase
        .from('bom_steps')
        .select(`
          id,
          step_number,
          name,
          description,
          estimated_duration_minutes,
          location_id,
          bin_id,
          location:locations(name, location_id),
          bin:bins(name, bin_id)
        `)
        .eq('bom_id', bomId)
        .order('step_number');

      if (stepsError) throw stepsError;
      setSteps((stepsData as any) || []);

      // Fetch all step items
      if (stepsData && stepsData.length > 0) {
        const stepIds = stepsData.map(s => s.id);
        const { data: itemsData, error: itemsError } = await supabase
          .from('bom_step_items')
          .select(`
            id,
            bom_step_id,
            product_id,
            quantity,
            product:products(name, product_id)
          `)
          .in('bom_step_id', stepIds);

        if (itemsError) throw itemsError;

        // Group items by step_id
        const itemsByStep: Record<string, BomStepItem[]> = {};
        (itemsData || []).forEach((item: any) => {
          if (!itemsByStep[item.bom_step_id]) {
            itemsByStep[item.bom_step_id] = [];
          }
          itemsByStep[item.bom_step_id].push(item);
        });
        setStepItems(itemsByStep);

        // Fetch initial bin inventory for first step
        if (stepsData[0]?.bin_id) {
          fetchBinInventory(stepsData[0].bin_id);
        }
      }
    } catch (error: any) {
      toast.error('Failed to load production steps');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBinInventory = async (binId: string) => {
    const { data, error } = await supabase
      .from('inventory')
      .select('id, product_id, quantity, bin_id')
      .eq('bin_id', binId)
      .gt('quantity', 0);

    if (!error && data) {
      setBinInventory(prev => ({ ...prev, [binId]: data }));
    }
  };

  // Get items for current step with availability status
  const currentStepItemsWithAvailability = useMemo(() => {
    if (!currentStep) return [];
    
    const items = stepItems[currentStep.id] || [];
    const inventory = currentStep.bin_id ? (binInventory[currentStep.bin_id] || []) : [];
    
    return items.map(item => {
      const required = item.quantity * quantity;
      const available = inventory
        .filter(inv => inv.product_id === item.product_id)
        .reduce((sum, inv) => sum + inv.quantity, 0);
      
      return {
        ...item,
        required,
        available,
        sufficient: available >= required,
      };
    });
  }, [currentStep, stepItems, binInventory, quantity]);

  // Check if current step can proceed
  const canProceed = useMemo(() => {
    if (!currentStep) return false;
    
    // If no items for this step, allow proceeding
    const items = stepItems[currentStep.id] || [];
    if (items.length === 0) return true;
    
    // If no bin assigned, allow proceeding (manual handling)
    if (!currentStep.bin_id) return true;
    
    // Check all items have sufficient inventory in the bin
    return currentStepItemsWithAvailability.every(item => item.sufficient);
  }, [currentStep, stepItems, currentStepItemsWithAvailability]);

  const handleConfirmStep = async () => {
    if (!currentStep) return;
    
    setIsLoading(true);
    try {
      const items = stepItems[currentStep.id] || [];
      
      // Perform goods withdrawal for each item if there's a bin
      if (currentStep.bin_id && items.length > 0) {
        // Get product prices for cost calculation
        const productIds = items.map(i => i.product_id);
        const { data: products } = await supabase
          .from('products')
          .select('id, price')
          .in('id', productIds);
        
        const productPrices = new Map(products?.map(p => [p.id, p.price || 0]) || []);
        
        // Find or get the location's ledger for posting transactions
        const { data: ledger } = await supabase
          .from('ledgers')
          .select('id')
          .eq('location_id', locationId)
          .eq('is_active', true)
          .limit(1)
          .single();
        
        for (const item of items) {
          const requiredQty = item.quantity * quantity;
          const unitCost = productPrices.get(item.product_id) || 0;
          const totalCost = requiredQty * unitCost;
          
          // Get inventory records for this product in this bin
          const { data: invRecords } = await supabase
            .from('inventory')
            .select('id, quantity')
            .eq('bin_id', currentStep.bin_id)
            .eq('product_id', item.product_id)
            .gt('quantity', 0)
            .order('quantity', { ascending: false });
          
          if (!invRecords || invRecords.length === 0) {
            throw new Error(`No inventory found for ${item.product?.name || 'product'} in bin`);
          }
          
          // Deduct from inventory records
          let remainingToDeduct = requiredQty;
          for (const inv of invRecords) {
            if (remainingToDeduct <= 0) break;
            
            const deductAmount = Math.min(inv.quantity, remainingToDeduct);
            const newQuantity = inv.quantity - deductAmount;
            
            if (newQuantity === 0) {
              await supabase.from('inventory').delete().eq('id', inv.id);
            } else {
              await supabase
                .from('inventory')
                .update({ quantity: newQuantity, updated_at: new Date().toISOString() })
                .eq('id', inv.id);
            }
            
            remainingToDeduct -= deductAmount;
          }
          
          // Create ledger transaction for the cost (negative = consumption)
          let ledgerTransactionId: string | null = null;
          if (ledger && totalCost > 0) {
            const { data: txn } = await supabase
              .from('ledger_transactions')
              .insert({
                ledger_id: ledger.id,
                transaction_type: 'production_consumption',
                reference_id: orderId,
                reference_number: orderNumber,
                amount: -totalCost,
                description: `Production consumption: ${item.product?.name} x${requiredQty} for ${orderNumber} Step ${currentStep.step_number}`,
                transaction_date: new Date().toISOString(),
              })
              .select('id')
              .single();
            
            ledgerTransactionId = txn?.id || null;
          }
          
          // Record the consumption
          await supabase
            .from('production_order_consumptions')
            .insert({
              production_order_id: orderId,
              bom_step_id: currentStep.id,
              product_id: item.product_id,
              quantity: requiredQty,
              unit_cost: unitCost,
              total_cost: totalCost,
              bin_id: currentStep.bin_id,
              ledger_transaction_id: ledgerTransactionId,
            });
        }
        
        // Refresh bin inventory
        await fetchBinInventory(currentStep.bin_id);
      }
      
      // Mark step as completed
      const newCompletedSteps = new Set([...completedSteps, currentStep.id]);
      setCompletedSteps(newCompletedSteps);
      await saveCompletedSteps(Array.from(newCompletedSteps));
      
      // Move to next step or complete
      if (currentStepIndex < steps.length - 1) {
        setCurrentStepIndex(prev => prev + 1);
        toast.success(`Step ${currentStep.step_number} completed`);
      } else {
        // All steps completed - perform goods receipt for finished goods
        await performFinishedGoodsReceipt();
        
        // Update order status
        await supabase
          .from('production_orders')
          .update({ 
            status: 'completed',
            completed_date: new Date().toISOString().split('T')[0],
          })
          .eq('id', orderId);
        
        toast.success('Production order completed!');
        onComplete();
        onOpenChange(false);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to confirm step');
      console.error(error);
    } finally {
      setIsLoading(false);
      setShowConfirmDialog(false);
    }
  };

  const handleSkipStep = async () => {
    if (currentStepIndex < steps.length - 1) {
      // Mark as completed but don't withdraw materials
      const newCompletedSteps = new Set([...completedSteps, currentStep.id]);
      setCompletedSteps(newCompletedSteps);
      await saveCompletedSteps(Array.from(newCompletedSteps));
      setCurrentStepIndex(prev => prev + 1);
      toast.info(`Skipped step ${currentStep?.step_number}`);
    }
  };

  if (!open) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={`flex flex-col overflow-hidden transition-all duration-200 ${isMaximized ? '!max-w-none !w-screen !h-screen !max-h-screen !rounded-none !translate-x-[-50%] !translate-y-[-50%]' : 'max-w-2xl max-h-[85vh]'}`}>
          <button
            type="button"
            onClick={() => setIsMaximized(!isMaximized)}
            className="absolute right-10 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10"
          >
            {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Production: {orderNumber}
            </DialogTitle>
            <DialogDescription>
              Complete each step to finish production. Materials will be withdrawn from the designated bin.
            </DialogDescription>
          </DialogHeader>

          {isLoading && steps.length === 0 ? (
            <div className="flex items-center justify-center py-12 flex-1">
              <span className="text-muted-foreground">Loading steps...</span>
            </div>
          ) : steps.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 flex-1">
              <AlertTriangle className="w-8 h-8 text-muted-foreground" />
              <p className="text-muted-foreground">No steps defined for this Bill of Materials</p>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
            </div>
          ) : (
            <>
              {/* Scrollable content area */}
              <div className="flex-1 overflow-y-auto min-h-0 space-y-4 p-4">
                {/* Progress */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Step {currentStepIndex + 1} of {steps.length}
                    </span>
                    <span className="text-muted-foreground">
                      {completedSteps.size} completed
                    </span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>

                {/* Step details */}
                {currentStep && (
                  <div className="space-y-4">
                    <div className="p-4 border rounded-lg space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-lg">
                            Step {currentStep.step_number}: {currentStep.name}
                          </h3>
                          {currentStep.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {currentStep.description}
                            </p>
                          )}
                        </div>
                        {currentStep.estimated_duration_minutes && (
                          <Badge variant="secondary" className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {currentStep.estimated_duration_minutes}m
                          </Badge>
                        )}
                      </div>

                      {currentStep.bin && (
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                          <span>
                            {currentStep.location?.name || 'Unknown Location'} → 
                            <span className="font-mono ml-1">{currentStep.bin.bin_id}</span> ({currentStep.bin.name})
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Materials required */}
                    {currentStepItemsWithAvailability.length > 0 ? (
                      <div className="space-y-2">
                        <h4 className="font-medium text-sm">Materials Required</h4>
                        <div className="border rounded-md">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Material</TableHead>
                                <TableHead className="text-right w-24">Required</TableHead>
                                <TableHead className="text-right w-24">In Bin</TableHead>
                                <TableHead className="text-right w-24">Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {currentStepItemsWithAvailability.map(item => (
                                <TableRow key={item.id}>
                                  <TableCell>
                                    <span className="font-medium">{item.product?.name}</span>
                                    <span className="text-xs text-muted-foreground ml-2">
                                      {item.product?.product_id}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-right font-mono">{item.required}</TableCell>
                                  <TableCell className="text-right font-mono">{item.available}</TableCell>
                                  <TableCell className="text-right">
                                    {item.sufficient ? (
                                      <Badge variant="default" className="bg-primary text-primary-foreground">
                                        <Check className="w-3 h-3 mr-1" />
                                        Ready
                                      </Badge>
                                    ) : item.available > 0 ? (
                                      <Badge variant="secondary" className="bg-accent text-accent-foreground">
                                        Partial
                                      </Badge>
                                    ) : (
                                      <Badge variant="destructive">
                                        <X className="w-3 h-3 mr-1" />
                                        Missing
                                      </Badge>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                        
                        {!canProceed && (
                          <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                            <AlertTriangle className="w-4 h-4 text-destructive" />
                            <span className="text-sm text-destructive">
                              Insufficient materials in the designated bin. Move inventory to proceed.
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-4 border border-dashed rounded-md text-center text-muted-foreground">
                        No materials assigned to this step
                      </div>
                    )}
                  </div>
                )}
              </div>

              <DialogFooter className="flex-shrink-0 gap-2 sm:gap-0 pt-4 border-t">
                <Button 
                  variant="ghost" 
                  onClick={handleSkipStep}
                  disabled={isLoading || currentStepIndex >= steps.length - 1}
                >
                  Skip Step
                </Button>
                <Button 
                  onClick={() => setShowConfirmDialog(true)}
                  disabled={isLoading || !canProceed}
                >
                  {currentStepIndex < steps.length - 1 ? (
                    <>
                      Confirm & Next
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </>
                  ) : (
                    <>
                      Complete Production
                      <Check className="w-4 h-4 ml-1" />
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Step Completion</AlertDialogTitle>
            <AlertDialogDescription>
              {currentStepItemsWithAvailability.length > 0 ? (
                <>
                  This will withdraw the following materials from bin{' '}
                  <span className="font-mono font-medium">{currentStep?.bin?.bin_id}</span>:
                  <ul className="mt-2 space-y-1">
                    {currentStepItemsWithAvailability.map(item => (
                      <li key={item.id} className="text-sm">
                        • {item.product?.name}: <span className="font-mono">{item.required}</span> units
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <>Mark step "{currentStep?.name}" as completed?</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmStep} disabled={isLoading}>
              {isLoading ? 'Processing...' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
