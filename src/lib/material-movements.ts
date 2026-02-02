import { supabase } from '@/integrations/supabase/client';

export type MovementType = 'receipt' | 'issue' | 'move_in' | 'move_out' | 'adjustment' | 'transfer';
export type ReferenceType = 'goods_receipt' | 'goods_issue' | 'inventory_transfer' | 'adjustment' | 'production';

interface CreateMovementParams {
  companyId: string;
  locationId: string;
  productId: string;
  quantity: number;
  movementType: MovementType;
  puId?: string | null;
  binId?: string | null;
  sourceBinId?: string | null;
  destinationBinId?: string | null;
  referenceType?: ReferenceType | null;
  referenceId?: string | null;
  referenceNumber?: string | null;
  notes?: string | null;
}

/**
 * Log a material movement to the material_movements table
 */
export async function logMaterialMovement(params: CreateMovementParams): Promise<string | null> {
  const {
    companyId,
    locationId,
    productId,
    quantity,
    movementType,
    puId,
    binId,
    sourceBinId,
    destinationBinId,
    referenceType,
    referenceId,
    referenceNumber,
    notes,
  } = params;

  // Get next movement ID
  const { data: movementId, error: idError } = await supabase.rpc('get_next_movement_id', {
    p_company_id: companyId,
  });

  if (idError) {
    console.error('Failed to generate movement ID:', idError);
    return null;
  }

  const { data, error } = await supabase
    .from('material_movements')
    .insert({
      movement_id: movementId,
      company_id: companyId,
      location_id: locationId,
      product_id: productId,
      quantity,
      movement_type: movementType,
      pu_id: puId || null,
      bin_id: binId || null,
      source_bin_id: sourceBinId || null,
      destination_bin_id: destinationBinId || null,
      reference_type: referenceType || null,
      reference_id: referenceId || null,
      reference_number: referenceNumber || null,
      notes: notes || null,
    })
    .select('movement_id')
    .single();

  if (error) {
    console.error('Failed to log material movement:', error);
    return null;
  }

  return data?.movement_id || null;
}

/**
 * Log multiple material movements in a batch
 */
export async function logMaterialMovementsBatch(
  movements: CreateMovementParams[]
): Promise<number> {
  let successCount = 0;

  for (const movement of movements) {
    const result = await logMaterialMovement(movement);
    if (result) successCount++;
  }

  return successCount;
}
