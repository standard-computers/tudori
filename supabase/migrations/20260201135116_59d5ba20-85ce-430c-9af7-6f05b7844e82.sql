-- Create trigger function for requisitions audit logging
CREATE OR REPLACE FUNCTION public.log_requisition_changes()
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
    -- Only log if status changed or linked to PO
    IF OLD.status IS DISTINCT FROM NEW.status OR OLD.purchase_order_id IS DISTINCT FROM NEW.purchase_order_id THEN
      v_action := 'UPDATE';
      v_changed_fields := '{}';
      
      -- Track status change
      IF OLD.status IS DISTINCT FROM NEW.status THEN
        v_changed_fields := array_append(v_changed_fields, 'status');
        v_old_value := COALESCE(v_old_value, '{}'::jsonb) || jsonb_build_object('status', OLD.status);
        v_new_value := COALESCE(v_new_value, '{}'::jsonb) || jsonb_build_object('status', NEW.status);
      END IF;
      
      -- Track PO conversion
      IF OLD.purchase_order_id IS DISTINCT FROM NEW.purchase_order_id THEN
        v_changed_fields := array_append(v_changed_fields, 'purchase_order_id');
        v_old_value := COALESCE(v_old_value, '{}'::jsonb) || jsonb_build_object('purchase_order_id', OLD.purchase_order_id);
        v_new_value := COALESCE(v_new_value, '{}'::jsonb) || jsonb_build_object('purchase_order_id', NEW.purchase_order_id);
      END IF;
      
      INSERT INTO public.audit_log (table_name, record_id, action, user_id, company_id, old_value, new_value, changed_fields)
      VALUES ('requisitions', NEW.id, v_action, v_user_id, NEW.company_id, v_old_value, v_new_value, v_changed_fields);
    END IF;
    
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Create triggers on requisitions table
CREATE TRIGGER requisitions_audit_insert
  AFTER INSERT ON public.requisitions
  FOR EACH ROW
  EXECUTE FUNCTION public.log_requisition_changes();

CREATE TRIGGER requisitions_audit_update
  AFTER UPDATE ON public.requisitions
  FOR EACH ROW
  EXECUTE FUNCTION public.log_requisition_changes();