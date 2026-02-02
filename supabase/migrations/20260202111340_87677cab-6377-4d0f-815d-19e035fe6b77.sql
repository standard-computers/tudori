CREATE OR REPLACE FUNCTION public.log_requisition_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_action TEXT;
  v_old_value JSONB := NULL;
  v_new_value JSONB := NULL;
  v_changed_fields TEXT[] := '{}';
  v_user_id UUID;
BEGIN
  -- Get the current user
  v_user_id := auth.uid();
  
  IF TG_OP = 'INSERT' THEN
    v_action := 'INSERT';
    v_new_value := jsonb_build_object(
      'requisition_id', NEW.requisition_id,
      'status', NEW.status,
      'vendor_id', NEW.vendor_id,
      'location_id', NEW.location_id,
      'notes', NEW.notes
    );
    v_changed_fields := ARRAY['created'];
    
    INSERT INTO public.audit_log (table_name, record_id, action, user_id, company_id, old_value, new_value, changed_fields)
    VALUES ('requisitions', NEW.id, v_action, v_user_id, NEW.company_id, v_old_value, v_new_value, v_changed_fields);
    
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
    -- Only log if status changed
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      v_action := 'UPDATE';
      v_changed_fields := ARRAY['status'];
      v_old_value := jsonb_build_object('status', OLD.status);
      v_new_value := jsonb_build_object('status', NEW.status);
      
      INSERT INTO public.audit_log (table_name, record_id, action, user_id, company_id, old_value, new_value, changed_fields)
      VALUES ('requisitions', NEW.id, v_action, v_user_id, NEW.company_id, v_old_value, v_new_value, v_changed_fields);
    END IF;
    
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;