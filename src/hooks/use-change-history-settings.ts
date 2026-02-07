import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ChangeHistorySettings {
  [documentType: string]: boolean;
}

export const useChangeHistorySettings = (companyId: string | null) => {
  const [settings, setSettings] = useState<ChangeHistorySettings>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (companyId) {
      fetchSettings();
    }
  }, [companyId]);

  const fetchSettings = async () => {
    if (!companyId) return;

    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('setting_value')
        .eq('company_id', companyId)
        .eq('setting_key', 'change_history_settings')
        .maybeSingle();

      if (error) throw error;

      if (data?.setting_value && typeof data.setting_value === 'object' && !Array.isArray(data.setting_value)) {
        const val = data.setting_value as Record<string, unknown>;
        const parsed: ChangeHistorySettings = {};
        Object.keys(val).forEach(key => {
          if (typeof val[key] === 'boolean') {
            parsed[key] = val[key] as boolean;
          }
        });
        setSettings(parsed);
      }
    } catch (error) {
      console.error('Error fetching change history settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const isHistoryEnabled = (documentType: string): boolean => {
    return settings[documentType] ?? true; // enabled by default
  };

  return {
    settings,
    loading,
    isHistoryEnabled,
    refetch: fetchSettings,
  };
};
