CREATE OR REPLACE FUNCTION public.log_sales_order_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_action TEXT;
  v_old_value JSONB := NULL;
  v_new_value JSONB := NULL;
  v_changed_fields TEXT[] := '{}';
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  IF TG_OP = 'INSERT' THEN
    v_action := 'INSERT';
    v_new_value := jsonb_build_object(
      'so_number', NEW.so_number,
      'status', NEW.status,
      'customer_id', NEW.customer_id,
      'location_id', NEW.location_id,
      'bill_to_location_id', NEW.bill_to_location_id,
      'ledger_id', NEW.ledger_id,
      'total_amount', NEW.total_amount,
      'notes', NEW.notes
    );
    v_changed_fields := ARRAY['created'];
    
    INSERT INTO public.audit_log (table_name, record_id, action, user_id, company_id, old_value, new_value, changed_fields)
    VALUES ('sales_orders', NEW.id, v_action, v_user_id, NEW.company_id, v_old_value, v_new_value, v_changed_fields);
    
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
    
    -- Track customer change
    IF OLD.customer_id IS DISTINCT FROM NEW.customer_id THEN
      v_changed_fields := array_append(v_changed_fields, 'customer_id');
      v_old_value := COALESCE(v_old_value, '{}'::jsonb) || jsonb_build_object('customer_id', OLD.customer_id);
      v_new_value := COALESCE(v_new_value, '{}'::jsonb) || jsonb_build_object('customer_id', NEW.customer_id);
    END IF;
    
    -- Track ship from location change
    IF OLD.location_id IS DISTINCT FROM NEW.location_id THEN
      v_changed_fields := array_append(v_changed_fields, 'location_id');
      v_old_value := COALESCE(v_old_value, '{}'::jsonb) || jsonb_build_object('location_id', OLD.location_id);
      v_new_value := COALESCE(v_new_value, '{}'::jsonb) || jsonb_build_object('location_id', NEW.location_id);
    END IF;
    
    -- Track bill from location change
    IF OLD.bill_to_location_id IS DISTINCT FROM NEW.bill_to_location_id THEN
      v_changed_fields := array_append(v_changed_fields, 'bill_to_location_id');
      v_old_value := COALESCE(v_old_value, '{}'::jsonb) || jsonb_build_object('bill_to_location_id', OLD.bill_to_location_id);
      v_new_value := COALESCE(v_new_value, '{}'::jsonb) || jsonb_build_object('bill_to_location_id', NEW.bill_to_location_id);
    END IF;
    
    -- Track ledger change
    IF OLD.ledger_id IS DISTINCT FROM NEW.ledger_id THEN
      v_changed_fields := array_append(v_changed_fields, 'ledger_id');
      v_old_value := COALESCE(v_old_value, '{}'::jsonb) || jsonb_build_object('ledger_id', OLD.ledger_id);
      v_new_value := COALESCE(v_new_value, '{}'::jsonb) || jsonb_build_object('ledger_id', NEW.ledger_id);
    END IF;
    
    -- Track total amount change
    IF OLD.total_amount IS DISTINCT FROM NEW.total_amount THEN
      v_changed_fields := array_append(v_changed_fields, 'total_amount');
      v_old_value := COALESCE(v_old_value, '{}'::jsonb) || jsonb_build_object('total_amount', OLD.total_amount);
      v_new_value := COALESCE(v_new_value, '{}'::jsonb) || jsonb_build_object('total_amount', NEW.total_amount);
    END IF;
    
    -- Track subtotal change
    IF OLD.subtotal IS DISTINCT FROM NEW.subtotal THEN
      v_changed_fields := array_append(v_changed_fields, 'subtotal');
      v_old_value := COALESCE(v_old_value, '{}'::jsonb) || jsonb_build_object('subtotal', OLD.subtotal);
      v_new_value := COALESCE(v_new_value, '{}'::jsonb) || jsonb_build_object('subtotal', NEW.subtotal);
    END IF;
    
    -- Track tax amount change
    IF OLD.tax_amount IS DISTINCT FROM NEW.tax_amount THEN
      v_changed_fields := array_append(v_changed_fields, 'tax_amount');
      v_old_value := COALESCE(v_old_value, '{}'::jsonb) || jsonb_build_object('tax_amount', OLD.tax_amount);
      v_new_value := COALESCE(v_new_value, '{}'::jsonb) || jsonb_build_object('tax_amount', NEW.tax_amount);
    END IF;
    
    -- Track notes change
    IF OLD.notes IS DISTINCT FROM NEW.notes THEN
      v_changed_fields := array_append(v_changed_fields, 'notes');
      v_old_value := COALESCE(v_old_value, '{}'::jsonb) || jsonb_build_object('notes', OLD.notes);
      v_new_value := COALESCE(v_new_value, '{}'::jsonb) || jsonb_build_object('notes', NEW.notes);
    END IF;
    
    -- Only insert if there were changes
    IF array_length(v_changed_fields, 1) > 0 THEN
      INSERT INTO public.audit_log (table_name, record_id, action, user_id, company_id, old_value, new_value, changed_fields)
      VALUES ('sales_orders', NEW.id, v_action, v_user_id, NEW.company_id, v_old_value, v_new_value, v_changed_fields);
    END IF;
    
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the trigger on sales_orders
CREATE TRIGGER trg_sales_orders_audit
AFTER INSERT OR UPDATE ON public.sales_orders
FOR EACH ROW
EXECUTE FUNCTION public.log_sales_order_changes();