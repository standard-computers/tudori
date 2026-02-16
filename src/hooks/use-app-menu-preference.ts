import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

let cachedValue: boolean | null = null;
let fetchPromise: Promise<boolean | null> | null = null;

export function setAppMenuPreferenceCache(val: boolean) {
  cachedValue = val;
}

export function useAppMenuPreference() {
  const { user } = useAuth();
  const [showAppMenu, setShowAppMenu] = useState<boolean>(cachedValue ?? true);

  useEffect(() => {
    if (!user) return;
    if (cachedValue !== null) {
      setShowAppMenu(cachedValue);
      return;
    }

    if (!fetchPromise) {
      fetchPromise = (async () => {
        const { data } = await supabase
          .from('user_preferences')
          .select('show_app_menu')
          .eq('user_id', user.id)
          .maybeSingle();
        const val = data?.show_app_menu ?? true;
        cachedValue = val;
        return val;
      })();
    }

    fetchPromise.then((val) => {
      setShowAppMenu(val);
    });
  }, [user]);

  return showAppMenu;
}
