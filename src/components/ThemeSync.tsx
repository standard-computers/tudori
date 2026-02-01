import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export const ThemeSync = () => {
  const { user } = useAuth();
  const { setTheme } = useTheme();

  useEffect(() => {
    const loadUserTheme = async () => {
      if (!user) return;

      const { data } = await supabase
        .from('user_preferences')
        .select('theme')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data?.theme) {
        setTheme(data.theme);
      }
    };

    loadUserTheme();
  }, [user, setTheme]);

  return null;
};
