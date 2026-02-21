CREATE OR REPLACE FUNCTION public.create_outbound_delivery(
  p_company_id uuid,
  p_purchase_order_id uuid DEFAULT NULL,
  p_from_location_id uuid DEFAULT NULL,
  p_to_location_id uuid DEFAULT NULL,
  p_status text DEFAULT 'pending',
  p_notes text DEFAULT NULL,
  p_customer_id uuid DEFAULT NULL,
  p_sales_order_id uuid DEFAULT NULL,
  p_carrier text DEFAULT NULL,
  p_tracking_number text DEFAULT NULL,
  p_expected_date timestamptz DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_config document_id_config%ROWTYPE;
  v_next_number INTEGER;
  v_delivery_number TEXT;
  v_delivery_id UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('odn_' || p_company_id::text));

  SELECT * INTO v_config FROM document_id_config
  WHERE company_id = p_company_id AND document_type = 'outbound_delivery'
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO document_id_config (company_id, document_type, prefix, num_digits, starting_number)
    VALUES (p_company_id, 'outbound_delivery', 'OD', 4, 1)
    RETURNING * INTO v_config;
  END IF;

  SELECT COALESCE(MAX(
    CASE 
      WHEN delivery_number ~ ('^' || COALESCE(v_config.prefix, '') || '[0-9]+$')
      THEN CAST(SUBSTRING(delivery_number FROM LENGTH(COALESCE(v_config.prefix, '')) + 1) AS INTEGER)
      ELSE 0
    END
  ), v_config.starting_number - 1) + 1
  INTO v_next_number
  FROM outbound_deliveries
  WHERE company_id = p_company_id;

  v_delivery_number := COALESCE(v_config.prefix, '') || LPAD(v_next_number::TEXT, v_config.num_digits, '0');

  INSERT INTO outbound_deliveries (
    company_id, delivery_number, purchase_order_id, from_location_id, to_location_id,
    status, notes, customer_id, sales_order_id, carrier, tracking_number, expected_date
  )
  VALUES (
    p_company_id, v_delivery_number, p_purchase_order_id, p_from_location_id, p_to_location_id,
    p_status, p_notes, p_customer_id, p_sales_order_id, p_carrier, p_tracking_number, p_expected_date
  )
  RETURNING id INTO v_delivery_id;

  RETURN json_build_object('id', v_delivery_id, 'delivery_number', v_delivery_number);
END;
$function$;