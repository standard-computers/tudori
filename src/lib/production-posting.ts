import { supabase } from '@/integrations/supabase/client';

/**
 * Whether production consumption should post a Goods Issue (default: enabled)
 */
export async function isProductionGIEnabled(companyId: string): Promise<boolean> {
  const { data } = await supabase
    .from('company_settings')
    .select('setting_value')
    .eq('company_id', companyId)
    .eq('setting_key', 'process_controls')
    .maybeSingle();
  const val = data?.setting_value as Record<string, unknown> | null;
  return typeof val?.perform_production_order_gi === 'boolean' ? val.perform_production_order_gi : true;
}

/**
 * Create a Goods Issue for production component consumption
 */
export async function createProductionGoodsIssue(params: {
  companyId: string;
  locationId: string;
  orderId: string;
  orderNumber: string;
  items: Array<{
    productId: string;
    quantity: number;
    binId: string | null;
  }>;
}): Promise<string | null> {
  const { companyId, locationId, orderId, orderNumber } = params;
  // Merge duplicate product/bin lines and drop zero quantities
  const merged = new Map<string, { productId: string; quantity: number; binId: string | null }>();
  for (const it of params.items) {
    if (!it.quantity || it.quantity <= 0) continue;
    const key = `${it.productId}|${it.binId ?? ''}`;
    const ex = merged.get(key);
    if (ex) ex.quantity += it.quantity; else merged.set(key, { ...it });
  }
  const items = Array.from(merged.values());

  if (items.length === 0) return null;
  if (!(await isProductionGIEnabled(companyId))) return null;

  try {
    // Generate GI number
    const { data: giNumber } = await supabase.rpc('get_next_goods_issue_number', {
      p_company_id: companyId,
    });

    if (!giNumber) return null;

    // Create goods issue
    const { data: gi, error: giError } = await supabase
      .from('goods_issues' as any)
      .insert({
        issue_number: giNumber,
        company_id: companyId,
        location_id: locationId,
        status: 'posted',
        production_order_id: orderId,
        notes: `Production consumption for ${orderNumber}`,
      })
      .select('id')
      .single();

    if (giError || !gi) {
      console.error('Failed to create production goods issue:', giError);
      return null;
    }

    const issueId = (gi as any).id;

    // Create goods issue items
    const giItems = items.map(item => ({
      goods_issue_id: issueId,
      product_id: item.productId,
      quantity: item.quantity,
      bin_id: item.binId,
      notes: `Production consumption for ${orderNumber}`,
    }));

    const { error: itemsError } = await supabase.from('goods_issue_items' as any).insert(giItems);
    if (itemsError) {
      console.error('Failed to create production goods issue items:', itemsError);
      await supabase.from('goods_issues' as any).delete().eq('id', issueId);
      return null;
    }

    return issueId;
  } catch (error) {
    console.error('Failed to create production goods issue:', error);
    return null;
  }
}

/**
 * Create a Goods Receipt for production finished goods output
 */
export async function createProductionGoodsReceipt(params: {
  companyId: string;
  locationId: string;
  orderId: string;
  orderNumber: string;
  productId: string;
  quantity: number;
  binId: string | null;
}): Promise<string | null> {
  const { companyId, locationId, orderId, orderNumber, productId, quantity, binId } = params;

  try {
    // Generate GR number
    const { data: grNumber } = await supabase.rpc('get_next_goods_receipt_number', {
      p_company_id: companyId,
    });

    if (!grNumber) return null;

    // Create goods receipt
    const { data: gr, error: grError } = await supabase
      .from('goods_receipts' as any)
      .insert({
        receipt_number: grNumber,
        company_id: companyId,
        location_id: locationId,
        status: 'posted',
        notes: `Production output from ${orderNumber}`,
      })
      .select('id')
      .single();

    if (grError || !gr) {
      console.error('Failed to create production goods receipt:', grError);
      return null;
    }

    const receiptId = (gr as any).id;

    // Create goods receipt item
    await supabase.from('goods_receipt_items' as any).insert({
      goods_receipt_id: receiptId,
      product_id: productId,
      quantity,
      bin_id: binId,
      notes: `Finished goods from production order ${orderNumber}`,
    });

    return receiptId;
  } catch (error) {
    console.error('Failed to create production goods receipt:', error);
    return null;
  }
}
