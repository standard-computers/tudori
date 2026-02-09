import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useReduceAppLoad() {
  const { user } = useAuth();
  const [reduceAppLoad, setReduceAppLoad] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchSetting = async () => {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!profile?.company_id) {
          setLoading(false);
          return;
        }

        const { data } = await supabase
          .from('company_settings')
          .select('setting_value')
          .eq('company_id', profile.company_id)
          .eq('setting_key', 'process_controls')
          .maybeSingle();

        if (data?.setting_value && typeof data.setting_value === 'object' && !Array.isArray(data.setting_value)) {
          const val = data.setting_value as Record<string, unknown>;
          setReduceAppLoad((val.reduce_app_load as boolean) ?? false);
        }
      } catch (error) {
        console.error('Error fetching reduce_app_load setting:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSetting();
  }, [user]);

  return { reduceAppLoad, loading };
}
