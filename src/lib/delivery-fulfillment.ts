import { supabase } from '@/integrations/supabase/client';

/**
 * Check if a delivery is fully received by comparing all GR items against delivery items.
 * If fully received, marks the delivery as 'delivered'. If partially received, marks as 'partially_delivered'.
 * Also keeps the parent PO status in sync (delivered vs partial).
 */
export async function checkAndCompleteDelivery(deliveryId: string): Promise<boolean> {
  if (!deliveryId) return false;

  try {
    // Get delivery items (expected quantities) and parent PO
    const { data: deliveryRow } = await supabase
      .from('deliveries')
      .select('id, purchase_order_id')
      .eq('id', deliveryId)
      .single();

    const { data: deliveryItems } = await supabase
      .from('delivery_items')
      .select('product_id, quantity')
      .eq('delivery_id', deliveryId);

    if (!deliveryItems || deliveryItems.length === 0) return false;

    // Get all goods receipts linked to this delivery
    const { data: linkedReceipts } = await supabase
      .from('goods_receipts')
      .select('id')
      .eq('delivery_id', deliveryId)
      .in('status', ['posted', 'pending']);

    const receiptIds = (linkedReceipts || []).map((r) => r.id);
    const receivedByProduct: Record<string, number> = {};

    if (receiptIds.length > 0) {
      const { data: grItems } = await supabase
        .from('goods_receipt_items')
        .select('product_id, quantity')
        .in('goods_receipt_id', receiptIds);

      for (const item of grItems || []) {
        receivedByProduct[item.product_id] = (receivedByProduct[item.product_id] || 0) + item.quantity;
      }
    }

    const fullyReceived = deliveryItems.every((di) => {
      const received = receivedByProduct[di.product_id] || 0;
      return received >= di.quantity;
    });
    const anyReceived = deliveryItems.some((di) => (receivedByProduct[di.product_id] || 0) > 0);

    if (fullyReceived) {
      await supabase
        .from('deliveries')
        .update({ status: 'delivered', delivered_date: new Date().toISOString().split('T')[0] })
        .eq('id', deliveryId);
    } else if (anyReceived) {
      await supabase
        .from('deliveries')
        .update({ status: 'partially_delivered' })
        .eq('id', deliveryId);
    }

    // Sync parent PO status
    if (deliveryRow?.purchase_order_id) {
      await syncPurchaseOrderStatus(deliveryRow.purchase_order_id);
    }

    return fullyReceived;
  } catch (err) {
    console.error('Error checking delivery fulfillment:', err);
    return false;
  }
}

/**
 * Compares total received qty across all deliveries+GRs for a PO against PO line item quantities.
 * Updates PO status: 'delivered' if fully received, 'partial' if some received, otherwise leaves alone.
 */
export async function syncPurchaseOrderStatus(purchaseOrderId: string): Promise<'delivered' | 'partial' | 'none'> {
  if (!purchaseOrderId) return 'none';

  try {
    const { data: poItems } = await supabase
      .from('purchase_order_items')
      .select('product_id, quantity')
      .eq('purchase_order_id', purchaseOrderId);

    if (!poItems || poItems.length === 0) return 'none';

    // Sum expected by product (handle duplicate lines)
    const expectedByProduct: Record<string, number> = {};
    for (const it of poItems) {
      expectedByProduct[it.product_id] = (expectedByProduct[it.product_id] || 0) + Number(it.quantity || 0);
    }

    // Get all deliveries for this PO
    const { data: deliveries } = await supabase
      .from('deliveries')
      .select('id')
      .eq('purchase_order_id', purchaseOrderId);

    const deliveryIds = (deliveries || []).map((d) => d.id);
    const receivedByProduct: Record<string, number> = {};

    if (deliveryIds.length > 0) {
      const { data: receipts } = await supabase
        .from('goods_receipts')
        .select('id')
        .in('delivery_id', deliveryIds)
        .in('status', ['posted', 'pending']);

      const receiptIds = (receipts || []).map((r) => r.id);
      if (receiptIds.length > 0) {
        const { data: grItems } = await supabase
          .from('goods_receipt_items')
          .select('product_id, quantity')
          .in('goods_receipt_id', receiptIds);
        for (const item of grItems || []) {
          receivedByProduct[item.product_id] = (receivedByProduct[item.product_id] || 0) + Number(item.quantity || 0);
        }
      }
    }

    const productIds = Object.keys(expectedByProduct);
    const fully = productIds.every((pid) => (receivedByProduct[pid] || 0) >= expectedByProduct[pid]);
    const any = productIds.some((pid) => (receivedByProduct[pid] || 0) > 0);

    if (fully) {
      await supabase.from('purchase_orders').update({ status: 'delivered' }).eq('id', purchaseOrderId);
      return 'delivered';
    }
    if (any) {
      await supabase.from('purchase_orders').update({ status: 'partial' }).eq('id', purchaseOrderId);
      return 'partial';
    }
    return 'none';
  } catch (err) {
    console.error('Error syncing PO status:', err);
    return 'none';
  }
}

/**
 * Same idea for sales orders / outbound deliveries (issued via goods_issues).
 */
export async function syncSalesOrderStatus(salesOrderId: string): Promise<'delivered' | 'partial' | 'none'> {
  if (!salesOrderId) return 'none';

  try {
    const { data: soItems } = await supabase
      .from('sales_order_items')
      .select('product_id, quantity')
      .eq('sales_order_id', salesOrderId);

    if (!soItems || soItems.length === 0) return 'none';

    const expectedByProduct: Record<string, number> = {};
    for (const it of soItems) {
      expectedByProduct[it.product_id] = (expectedByProduct[it.product_id] || 0) + Number(it.quantity || 0);
    }

    const { data: ods } = await supabase
      .from('outbound_deliveries')
      .select('id')
      .eq('sales_order_id', salesOrderId);

    const odIds = (ods || []).map((d) => d.id);
    const issuedByProduct: Record<string, number> = {};

    if (odIds.length > 0) {
      const { data: issues } = await supabase
        .from('goods_issues')
        .select('id')
        .in('outbound_delivery_id', odIds)
        .in('status', ['posted', 'pending']);

      const issueIds = (issues || []).map((r) => r.id);
      if (issueIds.length > 0) {
        const { data: giItems } = await supabase
          .from('goods_issue_items')
          .select('product_id, quantity')
          .in('goods_issue_id', issueIds);
        for (const item of giItems || []) {
          issuedByProduct[item.product_id] = (issuedByProduct[item.product_id] || 0) + Number(item.quantity || 0);
        }
      }
    }

    const productIds = Object.keys(expectedByProduct);
    const fully = productIds.every((pid) => (issuedByProduct[pid] || 0) >= expectedByProduct[pid]);
    const any = productIds.some((pid) => (issuedByProduct[pid] || 0) > 0);

    if (fully) {
      await supabase.from('sales_orders').update({ status: 'delivered' }).eq('id', salesOrderId);
      return 'delivered';
    }
    if (any) {
      await supabase.from('sales_orders').update({ status: 'partial' }).eq('id', salesOrderId);
      return 'partial';
    }
    return 'none';
  } catch (err) {
    console.error('Error syncing SO status:', err);
    return 'none';
  }
}
