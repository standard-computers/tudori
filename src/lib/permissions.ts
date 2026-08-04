import { supabase } from '@/integrations/supabase/client';

/**
 * Returns true when the given user is the only user in their company.
 * Sole users are treated as fully privileged regardless of their assigned role.
 */
export const isSoleCompanyUser = async (
  companyId?: string | null,
  userId?: string | null
): Promise<boolean> => {
  if (!companyId || !userId) return false;
  const { count, error } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId);
  if (error) return false;
  return (count ?? 0) <= 1;
};
