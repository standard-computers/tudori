import { supabase } from '@/integrations/supabase/client';
import { createPackagingUnit } from './packaging-units';

/**
 * Post a Goods Receipt - adds items to inventory and creates ledger transaction
 */
export async function postGoodsReceipt(receiptId: string, locationId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Get receipt with PO info to access ledger
    const { data: receipt } = await supabase
      .from('goods_receipts' as any)
      .select('*, purchase_order:purchase_orders(id, po_number, ledger_id)')
      .eq('id', receiptId)
      .single();

    // Get items for this receipt
    const { data: items } = await supabase
      .from('goods_receipt_items' as any)
      .select('*, product:products(name, price)')
      .eq('goods_receipt_id', receiptId);

    if (!items || items.length === 0) {
      return { success: false, error: 'Cannot post receipt with no items' };
    }

    // Add each item to inventory
    for (const item of items as any[]) {
      // Check if item has a PU assigned
      const puId = item.pu_id || null;
      
      if (puId) {
        // PU-based inventory: each PU is a separate inventory record
        await supabase
          .from('inventory')
          .insert({
            location_id: locationId,
            product_id: item.product_id,
            quantity: item.quantity,
            bin_id: item.bin_id || null,
            pu_id: puId,
          });
      } else {
        // Legacy behavior: aggregate by location/product/bin
        const { data: existingInventory } = await supabase
          .from('inventory')
          .select('id, quantity')
          .eq('location_id', locationId)
          .eq('product_id', item.product_id)
          .is('bin_id', item.bin_id || null)
          .is('pu_id', null)
          .maybeSingle();

        if (existingInventory) {
          await supabase
            .from('inventory')
            .update({ 
              quantity: existingInventory.quantity + item.quantity,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingInventory.id);
        } else {
          await supabase
            .from('inventory')
            .insert({
              location_id: locationId,
              product_id: item.product_id,
              quantity: item.quantity,
              bin_id: item.bin_id || null,
              pu_id: null,
            });
        }
      }
    }

    // Create positive ledger transaction if PO has a ledger
    const po = (receipt as any)?.purchase_order;
    if (po?.ledger_id) {
      // Calculate total value of received goods
      const totalValue = (items as any[]).reduce((sum, item) => {
        const price = item.product?.price || 0;
        return sum + (price * item.quantity);
      }, 0);

      if (totalValue > 0) {
        await supabase.from('ledger_transactions' as any).insert({
          ledger_id: po.ledger_id,
          transaction_type: 'goods_receipt',
          reference_id: receiptId,
          reference_number: (receipt as any).receipt_number,
          amount: totalValue, // Positive for goods received
          description: `Goods Receipt ${(receipt as any).receipt_number} for PO ${po.po_number}`,
          transaction_date: new Date().toISOString().split('T')[0],
        });
      }
    }

    // Update receipt status to posted
    await supabase
      .from('goods_receipts' as any)
      .update({ status: 'posted' })
      .eq('id', receiptId);

    return { success: true };
  } catch (error) {
    console.error('Failed to post goods receipt:', error);
    return { success: false, error: 'Failed to post goods receipt' };
  }
}

/**
 * Post a Goods Issue - deducts items from inventory and creates ledger transaction
 */
export async function postGoodsIssue(issueId: string, locationId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Get issue with SO info to access ledger
    const { data: issue } = await supabase
      .from('goods_issues' as any)
      .select('*, sales_order:sales_orders(id, so_number, ledger_id)')
      .eq('id', issueId)
      .single();

    // Get items for this issue with product prices
    const { data: items } = await supabase
      .from('goods_issue_items' as any)
      .select('*, product:products(name, price)')
      .eq('goods_issue_id', issueId);

    if (!items || items.length === 0) {
      return { success: false, error: 'Cannot post issue with no items' };
    }

    // Deduct each item from inventory
    for (const item of items as any[]) {
      // If item has a specific pu_id, use that exact record
      if (item.pu_id) {
        const { data: puInventory } = await supabase
          .from('inventory')
          .select('id, quantity, pu_id')
          .eq('location_id', locationId)
          .eq('product_id', item.product_id)
          .eq('pu_id', item.pu_id)
          .maybeSingle();
        
        if (puInventory) {
          // Delete the PU-based inventory record
          await supabase.from('inventory').delete().eq('id', puInventory.id);
          
          // Update PU status to 'issued'
          await supabase
            .from('packaging_units' as any)
            .update({ status: 'issued' })
            .eq('id', item.pu_id);
        }
        continue;
      }
      
      // If item has a specific bin_id, use it; otherwise find any available inventory
      let inventoryQuery = supabase
        .from('inventory')
        .select('id, quantity, bin_id, pu_id')
        .eq('location_id', locationId)
        .eq('product_id', item.product_id);
      
      if (item.bin_id) {
        // Specific bin requested
        inventoryQuery = inventoryQuery.eq('bin_id', item.bin_id);
      }
      
      const { data: inventoryRecords } = await inventoryQuery.order('quantity', { ascending: false });

      if (!inventoryRecords || inventoryRecords.length === 0) {
        const { data: productData } = await supabase
          .from('products')
          .select('name')
          .eq('id', item.product_id)
          .single();
        return { success: false, error: `No inventory found for ${productData?.name || 'product'} at this location` };
      }

      // Calculate total available
      const totalAvailable = inventoryRecords.reduce((sum, inv) => sum + inv.quantity, 0);
      if (totalAvailable < item.quantity) {
        const { data: productData } = await supabase
          .from('products')
          .select('name')
          .eq('id', item.product_id)
          .single();
        return { success: false, error: `Insufficient inventory for ${productData?.name || 'product'}. Available: ${totalAvailable}, Required: ${item.quantity}` };
      }

      // Deduct from inventory records (FIFO - start with largest quantities)
      let remainingToDeduct = item.quantity;
      for (const inv of inventoryRecords) {
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
    }

    // Create negative ledger transaction if SO has a ledger
    const so = (issue as any)?.sales_order;
    if (so?.ledger_id) {
      // Calculate total value of issued goods
      const totalValue = (items as any[]).reduce((sum, item) => {
        const price = item.product?.price || 0;
        return sum + (price * item.quantity);
      }, 0);

      if (totalValue > 0) {
        await supabase.from('ledger_transactions' as any).insert({
          ledger_id: so.ledger_id,
          transaction_type: 'goods_issue',
          reference_id: issueId,
          reference_number: (issue as any).issue_number,
          amount: -totalValue, // Negative for goods issued
          description: `Goods Issue ${(issue as any).issue_number} for SO ${so.so_number}`,
          transaction_date: new Date().toISOString().split('T')[0],
        });
      }
    }

    // Update issue status to posted
    await supabase
      .from('goods_issues' as any)
      .update({ status: 'posted' })
      .eq('id', issueId);

    return { success: true };
  } catch (error) {
    console.error('Failed to post goods issue:', error);
    return { success: false, error: 'Failed to post goods issue' };
  }
}
