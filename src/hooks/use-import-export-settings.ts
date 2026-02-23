import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ImportExportSettings {
  [documentType: string]: {
    import_enabled: boolean;
    export_enabled: boolean;
  };
}

const DEFAULT_SETTINGS: ImportExportSettings = {
  purchase_order: { import_enabled: false, export_enabled: true },
  sales_order: { import_enabled: false, export_enabled: true },
  requisition: { import_enabled: false, export_enabled: true },
  delivery: { import_enabled: false, export_enabled: true },
  goods_receipt: { import_enabled: false, export_enabled: true },
  goods_issue: { import_enabled: false, export_enabled: true },
  invoice: { import_enabled: false, export_enabled: true },
  credit_memo: { import_enabled: false, export_enabled: true },
  debit_memo: { import_enabled: false, export_enabled: true },
  account: { import_enabled: false, export_enabled: true },
  ledger: { import_enabled: false, export_enabled: true },
  vendor: { import_enabled: false, export_enabled: true },
  customer: { import_enabled: false, export_enabled: true },
  product: { import_enabled: false, export_enabled: true },
  location: { import_enabled: false, export_enabled: true },
  tax_rate: { import_enabled: false, export_enabled: true },
  carrier: { import_enabled: false, export_enabled: true },
  route: { import_enabled: false, export_enabled: true },
  assignment: { import_enabled: false, export_enabled: true },
  team: { import_enabled: false, export_enabled: true },
  bill_of_materials: { import_enabled: false, export_enabled: true },
  production_order: { import_enabled: false, export_enabled: true },
};

export const useImportExportSettings = (companyId: string | null) => {
  const [settings, setSettings] = useState<ImportExportSettings>(DEFAULT_SETTINGS);
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
        .eq('setting_key', 'import_export_settings')
        .maybeSingle();

      if (error) throw error;

      if (data?.setting_value && typeof data.setting_value === 'object' && !Array.isArray(data.setting_value)) {
        const val = data.setting_value as Record<string, unknown>;
        // Merge with defaults to ensure all document types exist
        const merged = { ...DEFAULT_SETTINGS };
        Object.keys(val).forEach(key => {
          if (merged[key] && typeof val[key] === 'object') {
            const docSettings = val[key] as Record<string, unknown>;
            merged[key] = {
              import_enabled: typeof docSettings.import_enabled === 'boolean' ? docSettings.import_enabled : false,
              export_enabled: typeof docSettings.export_enabled === 'boolean' ? docSettings.export_enabled : true,
            };
          }
        });
        setSettings(merged);
      }
    } catch (error) {
      console.error('Error fetching import/export settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const isImportEnabled = (documentType: string): boolean => {
    return settings[documentType]?.import_enabled ?? false;
  };

  const isExportEnabled = (documentType: string): boolean => {
    return settings[documentType]?.export_enabled ?? true;
  };

  return {
    settings,
    loading,
    isImportEnabled,
    isExportEnabled,
    refetch: fetchSettings,
  };
};
