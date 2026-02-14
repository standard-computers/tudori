
CREATE OR REPLACE FUNCTION public.log_location_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  changed text[] := '{}';
  old_vals jsonb;
  new_vals jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (table_name, record_id, action, new_value, user_id, company_id)
    VALUES ('locations', NEW.id, 'INSERT', to_jsonb(NEW), auth.uid(), NEW.company_id);
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
      VALUES ('locations', NEW.id, 'UPDATE', old_vals, new_vals, changed, auth.uid(), NEW.company_id);
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$function$;

CREATE TRIGGER log_location_changes_trigger
  AFTER INSERT OR UPDATE ON public.locations
  FOR EACH ROW
  EXECUTE FUNCTION public.log_location_changes();
