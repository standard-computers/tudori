-- Create audit log trigger function for customers
CREATE OR REPLACE FUNCTION public.log_customer_changes()
RETURNS TRIGGER AS $$
DECLARE
  changed text[] := '{}';
  old_vals jsonb;
  new_vals jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (table_name, record_id, action, new_value, user_id, company_id)
    VALUES ('customers', NEW.id, 'INSERT', to_jsonb(NEW), auth.uid(), NEW.company_id);
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
      VALUES ('customers', NEW.id, 'UPDATE', old_vals, new_vals, changed, auth.uid(), NEW.company_id);
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create triggers for INSERT and UPDATE on customers
CREATE TRIGGER customers_audit_insert
  AFTER INSERT ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.log_customer_changes();

CREATE TRIGGER customers_audit_update
  AFTER UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.log_customer_changes();