import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface TransactionAccess {
  accessMap: Record<string, boolean>;
  loading: boolean;
  hasAccess: (code: string) => boolean;
}

export const useTransactionAccess = (companyId?: string): TransactionAccess => {
  const { user } = useAuth();
  const [accessMap, setAccessMap] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAccess = async () => {
      if (!user || !companyId) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('user_transaction_access')
        .select('transaction_code, has_access')
        .eq('user_id', user.id)
        .eq('company_id', companyId);

      if (error) {
        console.error('Error fetching transaction access:', error);
        setLoading(false);
        return;
      }

      // Build access map - if no records exist, user has access to everything (default)
      const map: Record<string, boolean> = {};
      if (data && data.length > 0) {
        data.forEach((record) => {
          map[record.transaction_code] = record.has_access;
        });
      }
      
      setAccessMap(map);
      setLoading(false);
    };

    fetchAccess();
  }, [user, companyId]);

  const hasAccess = (code: string): boolean => {
    // If no access records exist (empty map), user has full access (default behavior)
    if (Object.keys(accessMap).length === 0) {
      return true;
    }
    // If code exists in map, use that value; otherwise default to true
    return accessMap[code] ?? true;
  };

  return { accessMap, loading, hasAccess };
};
