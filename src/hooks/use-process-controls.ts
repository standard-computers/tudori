import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ProcessControls {
  require_gr_on_delivery: boolean;
  require_delivery_receipt: boolean;
  track_bin_level_movements: boolean;
  enforce_route_records: boolean;
  reduce_app_load: boolean;
  contest_time_punch: boolean;
  contest_time_punch_days: number;
  show_product_images: boolean;
  allow_mass_deletion: boolean;
  allow_requisition_editing: boolean;
}

const DEFAULTS: ProcessControls = {
  require_gr_on_delivery: true,
  require_delivery_receipt: true,
  track_bin_level_movements: true,
  enforce_route_records: false,
  reduce_app_load: false,
  contest_time_punch: true,
  contest_time_punch_days: 7,
  show_product_images: false,
  allow_mass_deletion: false,
  allow_requisition_editing: true,
};

export function useProcessControls(companyId: string | null) {
  const [controls, setControls] = useState<ProcessControls>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    const fetchControls = async () => {
      try {
        const { data } = await supabase
          .from('company_settings')
          .select('setting_value')
          .eq('company_id', companyId)
          .eq('setting_key', 'process_controls')
          .maybeSingle();

        if (data?.setting_value && typeof data.setting_value === 'object' && !Array.isArray(data.setting_value)) {
          const val = data.setting_value as Record<string, unknown>;
          setControls({
            require_gr_on_delivery: (val.require_gr_on_delivery as boolean) ?? true,
            require_delivery_receipt: (val.require_delivery_receipt as boolean) ?? true,
            track_bin_level_movements: (val.track_bin_level_movements as boolean) ?? true,
            enforce_route_records: (val.enforce_route_records as boolean) ?? false,
            reduce_app_load: (val.reduce_app_load as boolean) ?? false,
            contest_time_punch: (val.contest_time_punch as boolean) ?? true,
            contest_time_punch_days: (val.contest_time_punch_days as number) ?? 7,
            show_product_images: (val.show_product_images as boolean) ?? false,
            allow_mass_deletion: (val.allow_mass_deletion as boolean) ?? false,
            allow_requisition_editing: (val.allow_requisition_editing as boolean) ?? true,
          });
        }
      } catch (error) {
        console.error('Error fetching process controls:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchControls();
  }, [companyId]);

  return { controls, loading };
}
