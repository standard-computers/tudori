CREATE OR REPLACE FUNCTION public.log_purchase_order_changes()
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
      'po_number', NEW.po_number,
      'status', NEW.status,
      'vendor_id', NEW.vendor_id,
      'location_id', NEW.location_id,
      'total_amount', NEW.total_amount,
      'notes', NEW.notes
    );
    v_changed_fields := ARRAY['created'];
    
    INSERT INTO public.audit_log (table_name, record_id, action, user_id, company_id, old_value, new_value, changed_fields)
    VALUES ('purchase_orders', NEW.id, v_action, v_user_id, NEW.company_id, v_old_value, v_new_value, v_changed_fields);
    
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'UPDATE';
    v_changed_fields := '{}';
    
    -- Track status change
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      v_changed_fields := array_append(v_changed_fields, 'status');
      v_old_value := COALESCE(v_old_value, '{}'::jsonb) || jsonb_build_object('status', OLD.status);
      v_new_value := COALESCE(v_new_value, '{}'::jsonb) || jsonb_build_object('status', NEW.status);
    END IF;
    
    -- Track vendor change
    IF OLD.vendor_id IS DISTINCT FROM NEW.vendor_id THEN
      v_changed_fields := array_append(v_changed_fields, 'vendor_id');
      v_old_value := COALESCE(v_old_value, '{}'::jsonb) || jsonb_build_object('vendor_id', OLD.vendor_id);
      v_new_value := COALESCE(v_new_value, '{}'::jsonb) || jsonb_build_object('vendor_id', NEW.vendor_id);
    END IF;
    
    -- Track location change
    IF OLD.location_id IS DISTINCT FROM NEW.location_id THEN
      v_changed_fields := array_append(v_changed_fields, 'location_id');
      v_old_value := COALESCE(v_old_value, '{}'::jsonb) || jsonb_build_object('location_id', OLD.location_id);
      v_new_value := COALESCE(v_new_value, '{}'::jsonb) || jsonb_build_object('location_id', NEW.location_id);
    END IF;
    
    -- Track total amount change
    IF OLD.total_amount IS DISTINCT FROM NEW.total_amount THEN
      v_changed_fields := array_append(v_changed_fields, 'total_amount');
      v_old_value := COALESCE(v_old_value, '{}'::jsonb) || jsonb_build_object('total_amount', OLD.total_amount);
      v_new_value := COALESCE(v_new_value, '{}'::jsonb) || jsonb_build_object('total_amount', NEW.total_amount);
    END IF;
    
    -- Only insert if there were changes
    IF array_length(v_changed_fields, 1) > 0 THEN
      INSERT INTO public.audit_log (table_name, record_id, action, user_id, company_id, old_value, new_value, changed_fields)
      VALUES ('purchase_orders', NEW.id, v_action, v_user_id, NEW.company_id, v_old_value, v_new_value, v_changed_fields);
    END IF;
    
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;