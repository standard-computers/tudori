CREATE OR REPLACE FUNCTION public.create_outbound_delivery(
  p_company_id UUID,
  p_purchase_order_id UUID,
  p_from_location_id UUID,
  p_to_location_id UUID,
  p_status TEXT DEFAULT 'pending',
  p_notes TEXT DEFAULT NULL,
  p_customer_id UUID DEFAULT NULL,
  p_sales_order_id UUID DEFAULT NULL,
  p_carrier TEXT DEFAULT NULL,
  p_tracking_number TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config document_id_config%ROWTYPE;
  v_current_max INTEGER;
  v_next_number INTEGER;
  v_delivery_number TEXT;
  v_delivery_id UUID;
BEGIN
  -- Acquire advisory lock to serialize delivery creation per company
  PERFORM pg_advisory_xact_lock(hashtext('odn_' || p_company_id::text));

  -- Get or create config
  SELECT * INTO v_config FROM document_id_config
  WHERE company_id = p_company_id AND document_type = 'outbound_delivery'
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO document_id_config (company_id, document_type, prefix, num_digits, starting_number)
    VALUES (p_company_id, 'outbound_delivery', 'OD', 4, 1)
    RETURNING * INTO v_config;
  END IF;

  -- Get current max delivery number
  SELECT COALESCE(MAX(
    NULLIF(regexp_replace(delivery_number, '[^0-9]', '', 'g'), '')::INTEGER
  ), v_config.starting_number - 1)
  INTO v_current_max
  FROM outbound_deliveries
  WHERE company_id = p_company_id;

  v_next_number := v_current_max + 1;
  v_delivery_number := COALESCE(v_config.prefix, '') || LPAD(v_next_number::TEXT, v_config.num_digits, '0');

  -- Insert the delivery atomically with the number
  INSERT INTO outbound_deliveries (
    company_id, delivery_number, purchase_order_id, from_location_id, to_location_id,
    status, notes, customer_id, sales_order_id, carrier, tracking_number
  )
  VALUES (
    p_company_id, v_delivery_number, p_purchase_order_id, p_from_location_id, p_to_location_id,
    p_status, p_notes, p_customer_id, p_sales_order_id, p_carrier, p_tracking_number
  )
  RETURNING id INTO v_delivery_id;

  RETURN json_build_object('id', v_delivery_id, 'delivery_number', v_delivery_number);
END;
$$;