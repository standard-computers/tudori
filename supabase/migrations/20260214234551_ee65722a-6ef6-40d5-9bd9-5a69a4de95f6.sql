
CREATE OR REPLACE FUNCTION public.log_location_user_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_company_id uuid;
  v_user_name text;
  v_target_user_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_target_user_id := NEW.user_id;
    SELECT company_id INTO v_company_id FROM public.locations WHERE id = NEW.location_id;
    SELECT COALESCE(first_name || ' ' || last_name, first_name, 'Unknown') INTO v_user_name
      FROM public.profiles WHERE user_id = v_target_user_id;

    INSERT INTO public.audit_log (table_name, record_id, action, new_value, changed_fields, user_id, company_id)
    VALUES (
      'locations', NEW.location_id, 'UPDATE',
      jsonb_build_object('user_added', COALESCE(v_user_name, 'Unknown'), 'role', NEW.role),
      ARRAY['user_added'], auth.uid(), v_company_id
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_target_user_id := OLD.user_id;
    SELECT company_id INTO v_company_id FROM public.locations WHERE id = OLD.location_id;
    SELECT COALESCE(first_name || ' ' || last_name, first_name, 'Unknown') INTO v_user_name
      FROM public.profiles WHERE user_id = v_target_user_id;

    INSERT INTO public.audit_log (table_name, record_id, action, old_value, changed_fields, user_id, company_id)
    VALUES (
      'locations', OLD.location_id, 'UPDATE',
      jsonb_build_object('user_removed', COALESCE(v_user_name, 'Unknown'), 'role', OLD.role),
      ARRAY['user_removed'], auth.uid(), v_company_id
    );
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.role IS DISTINCT FROM NEW.role THEN
      v_target_user_id := NEW.user_id;
      SELECT company_id INTO v_company_id FROM public.locations WHERE id = NEW.location_id;
      SELECT COALESCE(first_name || ' ' || last_name, first_name, 'Unknown') INTO v_user_name
        FROM public.profiles WHERE user_id = v_target_user_id;

      INSERT INTO public.audit_log (table_name, record_id, action, old_value, new_value, changed_fields, user_id, company_id)
      VALUES (
        'locations', NEW.location_id, 'UPDATE',
        jsonb_build_object('user_role_changed', COALESCE(v_user_name, 'Unknown'), 'role', OLD.role),
        jsonb_build_object('user_role_changed', COALESCE(v_user_name, 'Unknown'), 'role', NEW.role),
        ARRAY['user_role_changed'], auth.uid(), v_company_id
      );
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$function$;
