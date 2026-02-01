-- Create trigger function for purchase orders audit logging
CREATE OR REPLACE FUNCTION public.log_purchase_order_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
      'order_id', NEW.order_id,
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
    
    -- Track notes change
    IF OLD.notes IS DISTINCT FROM NEW.notes THEN
      v_changed_fields := array_append(v_changed_fields, 'notes');
      v_old_value := COALESCE(v_old_value, '{}'::jsonb) || jsonb_build_object('notes', OLD.notes);
      v_new_value := COALESCE(v_new_value, '{}'::jsonb) || jsonb_build_object('notes', NEW.notes);
    END IF;
    
    -- Track expected delivery date change
    IF OLD.expected_delivery IS DISTINCT FROM NEW.expected_delivery THEN
      v_changed_fields := array_append(v_changed_fields, 'expected_delivery');
      v_old_value := COALESCE(v_old_value, '{}'::jsonb) || jsonb_build_object('expected_delivery', OLD.expected_delivery);
      v_new_value := COALESCE(v_new_value, '{}'::jsonb) || jsonb_build_object('expected_delivery', NEW.expected_delivery);
    END IF;
    
    -- Only insert if something changed
    IF array_length(v_changed_fields, 1) > 0 THEN
      INSERT INTO public.audit_log (table_name, record_id, action, user_id, company_id, old_value, new_value, changed_fields)
      VALUES ('purchase_orders', NEW.id, v_action, v_user_id, NEW.company_id, v_old_value, v_new_value, v_changed_fields);
    END IF;
    
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Create triggers on purchase_orders table
CREATE TRIGGER purchase_orders_audit_insert
  AFTER INSERT ON public.purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.log_purchase_order_changes();

CREATE TRIGGER purchase_orders_audit_update
  AFTER UPDATE ON public.purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.log_purchase_order_changes();