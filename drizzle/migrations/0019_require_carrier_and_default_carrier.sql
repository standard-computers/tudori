ALTER TABLE public.carriers ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.enforce_delivery_carrier()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_key text := CASE WHEN TG_TABLE_NAME = 'outbound_deliveries' THEN 'require_carrier_outbound' ELSE 'require_carrier_inbound' END;
  v_required boolean;
  v_default text;
BEGIN
  IF lower(coalesce(NEW.status,'pending')) IN ('pending','deleted','canceled','cancelled') THEN
    RETURN NEW;
  END IF;
  IF NEW.carrier IS NOT NULL AND btrim(NEW.carrier) <> '' THEN
    RETURN NEW;
  END IF;
  SELECT coalesce((setting_value->>v_key)::boolean, false) INTO v_required
  FROM company_settings WHERE company_id = NEW.company_id AND setting_key = 'process_controls';
  IF NOT coalesce(v_required, false) THEN
    RETURN NEW;
  END IF;
  SELECT name INTO v_default FROM carriers
  WHERE company_id = NEW.company_id AND is_default AND is_active
  ORDER BY carrier_id LIMIT 1;
  IF v_default IS NOT NULL THEN
    NEW.carrier := v_default;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'A carrier is required for deliveries that are not pending';
END $$;

DROP TRIGGER IF EXISTS trg_enforce_carrier ON public.deliveries;
CREATE TRIGGER trg_enforce_carrier BEFORE INSERT OR UPDATE ON public.deliveries
FOR EACH ROW EXECUTE FUNCTION public.enforce_delivery_carrier();
DROP TRIGGER IF EXISTS trg_enforce_carrier ON public.outbound_deliveries;
CREATE TRIGGER trg_enforce_carrier BEFORE INSERT OR UPDATE ON public.outbound_deliveries
FOR EACH ROW EXECUTE FUNCTION public.enforce_delivery_carrier();