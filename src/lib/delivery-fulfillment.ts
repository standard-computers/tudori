import { supabase } from '@/integrations/supabase/client';

/**
 * Check if a delivery is fully received by comparing all GR items against delivery items.
 * If fully received, marks the delivery as 'delivered'.
 */
export async function checkAndCompleteDelivery(deliveryId: string): Promise<boolean> {
  if (!deliveryId) return false;

  try {
    // Get delivery items (expected quantities)
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

    if (!linkedReceipts || linkedReceipts.length === 0) return false;

    const receiptIds = linkedReceipts.map((r) => r.id);

    // Get all GR items across all linked receipts
    const { data: grItems } = await supabase
      .from('goods_receipt_items')
      .select('product_id, quantity')
      .in('goods_receipt_id', receiptIds);

    if (!grItems) return false;

    // Sum received quantities per product
    const receivedByProduct: Record<string, number> = {};
    for (const item of grItems) {
      receivedByProduct[item.product_id] = (receivedByProduct[item.product_id] || 0) + item.quantity;
    }

    // Check if every delivery item is fully received
    const fullyReceived = deliveryItems.every((di) => {
      const received = receivedByProduct[di.product_id] || 0;
      return received >= di.quantity;
    });

    if (fullyReceived) {
      await supabase
        .from('deliveries')
        .update({ status: 'delivered', delivered_date: new Date().toISOString().split('T')[0] })
        .eq('id', deliveryId);
      return true;
    }

    return false;
  } catch (err) {
    console.error('Error checking delivery fulfillment:', err);
    return false;
  }
}
