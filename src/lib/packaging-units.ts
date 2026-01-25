import { supabase } from '@/integrations/supabase/client';

export interface PackagingUnit {
  id: string;
  pu_number: string;
  company_id: string;
  product_id: string | null;
  quantity: number;
  status: string;
  created_at: string;
  updated_at: string;
}

/**
 * Generate a single packaging unit number
 */
export async function generatePUNumber(companyId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_next_pu_number', {
    p_company_id: companyId,
  });
  
  if (error) {
    console.error('Failed to generate PU number:', error);
    return null;
  }
  
  return data;
}

/**
 * Create a packaging unit and return its ID
 */
export async function createPackagingUnit(
  companyId: string,
  productId: string,
  quantity: number = 1
): Promise<{ id: string; pu_number: string } | null> {
  // Get next PU number
  const puNumber = await generatePUNumber(companyId);
  if (!puNumber) return null;
  
  const { data, error } = await supabase
    .from('packaging_units' as any)
    .insert({
      pu_number: puNumber,
      company_id: companyId,
      product_id: productId,
      quantity,
      status: 'active',
    })
    .select('id, pu_number')
    .single();
  
  if (error) {
    console.error('Failed to create packaging unit:', error);
    return null;
  }
  
  return data as unknown as { id: string; pu_number: string };
}

/**
 * Create multiple packaging units for exploded items
 * Returns an array of PU IDs/numbers
 */
export async function createMultiplePackagingUnits(
  companyId: string,
  items: Array<{ productId: string; quantity: number }>
): Promise<Array<{ id: string; pu_number: string; product_id: string }>> {
  const results: Array<{ id: string; pu_number: string; product_id: string }> = [];
  
  for (const item of items) {
    const pu = await createPackagingUnit(companyId, item.productId, item.quantity);
    if (pu) {
      results.push({ ...pu, product_id: item.productId });
    }
  }
  
  return results;
}

/**
 * Update packaging unit status (e.g., when issued out)
 */
export async function updatePackagingUnitStatus(
  puId: string,
  status: 'active' | 'issued' | 'consumed' | 'returned'
): Promise<boolean> {
  const { error } = await supabase
    .from('packaging_units' as any)
    .update({ status })
    .eq('id', puId);
  
  if (error) {
    console.error('Failed to update packaging unit status:', error);
    return false;
  }
  
  return true;
}

/**
 * Get packaging unit by ID
 */
export async function getPackagingUnit(puId: string): Promise<PackagingUnit | null> {
  const { data, error } = await supabase
    .from('packaging_units' as any)
    .select('*')
    .eq('id', puId)
    .single();
  
  if (error) {
    console.error('Failed to get packaging unit:', error);
    return null;
  }
  
  return data as unknown as PackagingUnit;
}

/**
 * Get packaging units by PU numbers
 */
export async function getPackagingUnitsByNumbers(
  puNumbers: string[],
  companyId: string
): Promise<PackagingUnit[]> {
  const { data, error } = await supabase
    .from('packaging_units' as any)
    .select('*')
    .eq('company_id', companyId)
    .in('pu_number', puNumbers);
  
  if (error) {
    console.error('Failed to get packaging units:', error);
    return [];
  }
  
  return (data || []) as unknown as PackagingUnit[];
}
