CREATE OR REPLACE FUNCTION public.get_next_asset_id(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_config document_id_config%ROWTYPE;
  v_next_number INTEGER;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid() AND company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'Access denied: User does not belong to this company';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_company_id::text || ':asset'));

  SELECT * INTO v_config
  FROM document_id_config
  WHERE company_id = p_company_id AND document_type = 'asset';

  IF NOT FOUND THEN
    INSERT INTO document_id_config (company_id, document_type, prefix, starting_number, num_digits)
    VALUES (p_company_id, 'asset', 'AST-', 1, 4)
    RETURNING * INTO v_config;
  END IF;

  SELECT COALESCE(MAX(
    CASE
      WHEN asset_tag ~ ('^' || COALESCE(v_config.prefix, '') || '[0-9]+$')
      THEN CAST(SUBSTRING(asset_tag FROM LENGTH(COALESCE(v_config.prefix, '')) + 1) AS INTEGER)
      ELSE 0
    END
  ), v_config.starting_number - 1) + 1
  INTO v_next_number
  FROM assets
  WHERE company_id = p_company_id;

  RETURN COALESCE(v_config.prefix, '') || LPAD(v_next_number::TEXT, v_config.num_digits, '0');
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_next_asset_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_next_asset_id(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.log_asset_changes()
RETURNS TRIGGER AS $$
DECLARE
  changed text[] := '{}';
  old_vals jsonb;
  new_vals jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (table_name, record_id, action, new_value, user_id, company_id)
    VALUES ('assets', NEW.id, 'INSERT', to_jsonb(NEW), auth.uid(), NEW.company_id);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    old_vals := to_jsonb(OLD);
    new_vals := to_jsonb(NEW);

    SELECT array_agg(key) INTO changed
    FROM jsonb_each(new_vals) n
    WHERE n.key NOT IN ('updated_at', 'created_at')
      AND (old_vals -> n.key IS DISTINCT FROM n.value);

    IF changed IS NOT NULL AND array_length(changed, 1) > 0 THEN
      INSERT INTO public.audit_log (table_name, record_id, action, old_value, new_value, changed_fields, user_id, company_id)
      VALUES ('assets', NEW.id, 'UPDATE', old_vals, new_vals, changed, auth.uid(), NEW.company_id);
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_assets_audit ON public.assets;
CREATE TRIGGER trg_assets_audit
AFTER INSERT OR UPDATE ON public.assets
FOR EACH ROW
EXECUTE FUNCTION public.log_asset_changes();