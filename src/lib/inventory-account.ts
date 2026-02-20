import { supabase } from '@/integrations/supabase/client';

/**
 * Resolve the ledger_id from the location's Inventory account.
 * Falls back to the location's direct ledger, then company general ledger.
 */
export async function getInventoryLedgerId(locationId: string, companyId?: string): Promise<string | null> {
  // 1. Look for Inventory account linked to this location
  const { data: inventoryAccount } = await supabase
    .from('accounts' as any)
    .select('id, ledger_id')
    .eq('location_id', locationId)
    .eq('type', 'inventory')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if ((inventoryAccount as any)?.ledger_id) {
    return (inventoryAccount as any).ledger_id;
  }

  // 2. Fallback: location's direct ledger
  const { data: locationLedger } = await supabase
    .from('ledgers' as any)
    .select('id')
    .eq('location_id', locationId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (locationLedger) {
    return (locationLedger as any).id;
  }

  // 3. Fallback: company general ledger
  if (companyId) {
    const { data: generalLedger } = await supabase
      .from('ledgers' as any)
      .select('id')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .is('location_id', null)
      .limit(1)
      .maybeSingle();

    if (generalLedger) {
      return (generalLedger as any).id;
    }
  }

  return null;
}
