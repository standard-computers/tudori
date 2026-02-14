
CREATE OR REPLACE FUNCTION public.log_location_user_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_company_id uuid;
  v_user_email text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT company_id INTO v_company_id FROM public.locations WHERE id = NEW.location_id;
    v_user_email := public.get_auth_email(NEW.user_id);

    INSERT INTO public.audit_log (table_name, record_id, action, new_value, changed_fields, user_id, company_id)
    VALUES (
      'locations',
      NEW.location_id,
      'UPDATE',
      jsonb_build_object('user_added', v_user_email, 'role', NEW.role),
      ARRAY['user_added'],
      auth.uid(),
      v_company_id
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    SELECT company_id INTO v_company_id FROM public.locations WHERE id = OLD.location_id;
    v_user_email := public.get_auth_email(OLD.user_id);

    INSERT INTO public.audit_log (table_name, record_id, action, old_value, changed_fields, user_id, company_id)
    VALUES (
      'locations',
      OLD.location_id,
      'UPDATE',
      jsonb_build_object('user_removed', v_user_email, 'role', OLD.role),
      ARRAY['user_removed'],
      auth.uid(),
      v_company_id
    );
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.role IS DISTINCT FROM NEW.role THEN
      SELECT company_id INTO v_company_id FROM public.locations WHERE id = NEW.location_id;
      v_user_email := public.get_auth_email(NEW.user_id);

      INSERT INTO public.audit_log (table_name, record_id, action, old_value, new_value, changed_fields, user_id, company_id)
      VALUES (
        'locations',
        NEW.location_id,
        'UPDATE',
        jsonb_build_object('user_role_changed', v_user_email, 'role', OLD.role),
        jsonb_build_object('user_role_changed', v_user_email, 'role', NEW.role),
        ARRAY['user_role_changed'],
        auth.uid(),
        v_company_id
      );
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$function$;

CREATE TRIGGER log_location_user_changes_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.location_users
  FOR EACH ROW
  EXECUTE FUNCTION public.log_location_user_changes();
