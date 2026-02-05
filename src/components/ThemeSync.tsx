 import { useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/contexts/AuthContext';
 import { supabase } from '@/integrations/supabase/client';
 import { applyDesignSystem } from '@/config/design-systems';

export const ThemeSync = () => {
  const { user } = useAuth();
  const { setTheme } = useTheme();
   const appliedRef = useRef(false);

  useEffect(() => {
     const loadUserPreferences = async () => {
      if (!user) return;
       if (appliedRef.current) return;

      const { data } = await supabase
        .from('user_preferences')
         .select('theme, design_system')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data?.theme) {
        setTheme(data.theme);
         // Apply design system with the theme
         const designSystem = data.design_system || 'default';
         applyDesignSystem(designSystem, data.theme as 'light' | 'dark');
         appliedRef.current = true;
      }
    };

     loadUserPreferences();
  }, [user, setTheme]);

  return null;
};
