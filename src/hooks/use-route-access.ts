import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PATH_TO_CODE } from '@/config/transaction-codes';

/**
 * Hook to check if the current user has access to a specific route
 * Redirects to dashboard if access is denied
 */
export const useRouteAccess = (path: string) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [hasAccess, setHasAccess] = useState(true);

  useEffect(() => {
    const checkAccess = async () => {
      if (!user) {
        setChecking(false);
        return;
      }

      // Normalize path - handle dynamic routes like /accounts/:id
      let normalizedPath = path;
      if (path.startsWith('/accounts/') && path !== '/accounts') {
        normalizedPath = '/accounts';
      }

      const code = PATH_TO_CODE[normalizedPath];
      if (!code) {
        // No transaction code for this path, allow access
        setChecking(false);
        setHasAccess(true);
        return;
      }

      // Get user's company_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.company_id) {
        setChecking(false);
        setHasAccess(true);
        return;
      }

      // Check transaction access
      const { data: accessData } = await supabase
        .from('user_transaction_access')
        .select('has_access')
        .eq('user_id', user.id)
        .eq('company_id', profile.company_id)
        .eq('transaction_code', code)
        .maybeSingle();

      // If no record exists, default to true (full access)
      // If record exists, use its has_access value
      const allowed = accessData === null ? true : accessData.has_access;

      if (!allowed) {
        navigate('/dashboard');
      }

      setHasAccess(allowed);
      setChecking(false);
    };

    checkAccess();
  }, [user, path, navigate]);

  return { checking, hasAccess };
};
