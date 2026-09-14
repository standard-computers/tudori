import { supabase } from '@/integrations/supabase/client';
import { createPackagingUnit } from './packaging-units';
import { getInventoryLedgerId } from './inventory-account';

/**
 * Post a Goods Receipt - adds items to inventory and creates ledger transaction
 */
export async function postGoodsReceipt(receiptId: string, locationId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Get receipt with PO info
    const { data: receipt } = await supabase
      .from('goods_receipts' as any)
      .select('*, purchase_order:purchase_orders(id, po_number, ledger_id)')
      .eq('id', receiptId)
      .single();

    // Get items for this receipt
    const { data: items } = await supabase
      .from('goods_receipt_items' as any)
      .select('*, product:products(name, price), uom:product_uoms(id, conversion_factor)')
      .eq('goods_receipt_id', receiptId);

    if (!items || items.length === 0) {
      return { success: false, error: 'Cannot post receipt with no items' };
    }

    // Add each item to inventory — preserve the receipt UoM (no base-unit conversion).
    // Each receipt line is processed independently; lines that land on the same
    // location/bin/product/PU slot are merged (quantities added) so no line is lost.
    for (const item of items as any[]) {
      const puId = item.pu_id || null;
      const batchId = item.batch_id || null;
      const uomId = item.uom_id || null;
      const binId = item.bin_id || null;
      const qty = Math.round(item.quantity);
      if (!qty) continue;

      let query = supabase
        .from('inventory')
        .select('id, quantity')
        .eq('location_id', locationId)
        .eq('product_id', item.product_id);

      query = binId ? query.eq('bin_id', binId) : query.is('bin_id', null);
      query = puId ? query.eq('pu_id', puId) : query.is('pu_id', null);
      query = uomId ? query.eq('uom_id', uomId) : query.is('uom_id', null);
      query = batchId ? query.eq('batch_id', batchId) : query.is('batch_id', null);

      const { data: existingInventory } = await query.maybeSingle();

      if (existingInventory) {
        const { error: updateError } = await supabase
          .from('inventory')
          .update({
            quantity: existingInventory.quantity + qty,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingInventory.id);
        if (updateError) {
          console.error('Failed to update inventory for receipt line:', updateError);
          return { success: false, error: `Failed to receive line: ${updateError.message}` };
        }
      } else {
        const { error: insertError } = await supabase
          .from('inventory')
          .insert({
            location_id: locationId,
            product_id: item.product_id,
            quantity: qty,
            bin_id: binId,
            pu_id: puId,
            batch_id: batchId,
            uom_id: uomId,
          } as any);

        if (insertError) {
          // Slot already exists (e.g. same PU/bin/product from an earlier line) — merge instead
          let retry = supabase
            .from('inventory')
            .select('id, quantity')
            .eq('location_id', locationId)
            .eq('product_id', item.product_id);
          retry = binId ? retry.eq('bin_id', binId) : retry.is('bin_id', null);
          retry = puId ? retry.eq('pu_id', puId) : retry.is('pu_id', null);
          const { data: conflictRow } = await retry.limit(1).maybeSingle();

          if (conflictRow) {
            const { error: mergeError } = await supabase
              .from('inventory')
              .update({
                quantity: conflictRow.quantity + qty,
                updated_at: new Date().toISOString(),
              })
              .eq('id', conflictRow.id);
            if (mergeError) {
              console.error('Failed to merge inventory for receipt line:', mergeError);
              return { success: false, error: `Failed to receive line: ${mergeError.message}` };
            }
          } else {
            console.error('Failed to insert inventory for receipt line:', insertError);
            return { success: false, error: `Failed to receive line: ${insertError.message}` };
          }
        }
      }
    }


    // Resolve ledger: Inventory account → location ledger → company general
    const companyId = (receipt as any)?.company_id;
    const ledgerId = await getInventoryLedgerId(locationId, companyId);

    if (ledgerId) {
      const totalValue = (items as any[]).reduce((sum, item) => {
        const price = item.product?.price || 0;
        const conversionFactor = item.uom?.conversion_factor || 1;
        const baseQty = item.quantity * conversionFactor;
        return sum + (price * baseQty);
      }, 0);

      if (totalValue > 0) {
        await supabase.from('ledger_transactions' as any).insert({
          ledger_id: ledgerId,
          transaction_type: 'goods_receipt',
          reference_id: receiptId,
          reference_number: (receipt as any).receipt_number,
          amount: totalValue,
          description: `Goods Receipt ${(receipt as any).receipt_number}`,
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
    // Get issue
    const { data: issue } = await supabase
      .from('goods_issues' as any)
      .select('*')
      .eq('id', issueId)
      .single();

    // Get items for this issue with product prices
    const { data: items } = await supabase
      .from('goods_issue_items' as any)
      .select('*, product:products(name, price), uom:product_uoms(id, conversion_factor)')
      .eq('goods_issue_id', issueId);

    if (!items || items.length === 0) {
      return { success: false, error: 'Cannot post issue with no items' };
    }

    // Deduct each item from inventory — match same UoM if specified, otherwise any
    for (const item of items as any[]) {
      const uomId = item.uom_id || null;
      const qty = Math.round(item.quantity);

      if (item.pu_id) {
        const { data: puInventory } = await supabase
          .from('inventory')
          .select('id, quantity, pu_id')
          .eq('location_id', locationId)
          .eq('product_id', item.product_id)
          .eq('pu_id', item.pu_id)
          .maybeSingle();

        if (puInventory) {
          await supabase.from('inventory').delete().eq('id', puInventory.id);
          await supabase
            .from('packaging_units' as any)
            .update({ status: 'issued' })
            .eq('id', item.pu_id);
        }
        continue;
      }

      let inventoryQuery = supabase
        .from('inventory')
        .select('id, quantity, bin_id, pu_id, uom_id')
        .eq('location_id', locationId)
        .eq('product_id', item.product_id);

      if (item.bin_id) {
        inventoryQuery = inventoryQuery.eq('bin_id', item.bin_id);
      }

      if (uomId) {
        inventoryQuery = inventoryQuery.eq('uom_id', uomId);
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

      const totalAvailable = inventoryRecords.reduce((sum, inv) => sum + inv.quantity, 0);
      if (totalAvailable < qty) {
        const { data: productData } = await supabase
          .from('products')
          .select('name')
          .eq('id', item.product_id)
          .single();
        return { success: false, error: `Insufficient inventory for ${productData?.name || 'product'}. Available: ${totalAvailable}, Required: ${qty}` };
      }

      let remainingToDeduct = qty;
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

    // Resolve ledger: Inventory account → location ledger → company general
    const companyId = (issue as any)?.company_id;
    const ledgerId = await getInventoryLedgerId(locationId, companyId);

    if (ledgerId) {
      const totalValue = (items as any[]).reduce((sum, item) => {
        const price = item.product?.price || 0;
        const conversionFactor = item.uom?.conversion_factor || 1;
        const baseQty = item.quantity * conversionFactor;
        return sum + (price * baseQty);
      }, 0);

      if (totalValue > 0) {
        await supabase.from('ledger_transactions' as any).insert({
          ledger_id: ledgerId,
          transaction_type: 'goods_issue',
          reference_id: issueId,
          reference_number: (issue as any).issue_number,
          amount: -totalValue,
          description: `Goods Issue ${(issue as any).issue_number}`,
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
