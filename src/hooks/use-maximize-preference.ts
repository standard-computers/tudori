import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

let cachedValue: boolean | null = null;
const listeners: Set<(val: boolean) => void> = new Set();

/** Reads the maximize_windows preference (cached after first fetch) */
export const useMaximizePreference = () => {
  const { user } = useAuth();
  const [maximizeWindows, setMaximizeWindows] = useState(cachedValue ?? false);

  useEffect(() => {
    listeners.add(setMaximizeWindows);
    return () => { listeners.delete(setMaximizeWindows); };
  }, []);

  useEffect(() => {
    if (!user || cachedValue !== null) return;

    supabase
      .from('user_preferences')
      .select('maximize_windows')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        const val = data?.maximize_windows ?? false;
        cachedValue = val;
        listeners.forEach(fn => fn(val));
      });
  }, [user]);

  return maximizeWindows;
};

/** Update cache when user toggles the setting */
export const setMaximizePreferenceCache = (val: boolean) => {
  cachedValue = val;
  listeners.forEach(fn => fn(val));
};

/**
 * Drop-in replacement for `useState(false)` on maximize state.
 * Initializes from the user's maximize_windows preference.
 */
export const useMaximizedState = (): [boolean, React.Dispatch<React.SetStateAction<boolean>>] => {
  const prefValue = useMaximizePreference();
  const [isMaximized, setIsMaximized] = useState(prefValue);

  // Sync when preference loads
  useEffect(() => {
    setIsMaximized(prefValue);
  }, [prefValue]);

  return [isMaximized, setIsMaximized];
};
