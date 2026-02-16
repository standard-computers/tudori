CREATE OR REPLACE FUNCTION public.get_next_outbound_delivery_number(p_company_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config document_id_config%ROWTYPE;
  v_current_max INTEGER;
  v_next_number INTEGER;
  v_formatted TEXT;
BEGIN
  -- Acquire an advisory lock to prevent concurrent calls from getting the same number
  PERFORM pg_advisory_xact_lock(hashtext('odn_' || p_company_id::text));

  -- Try to get config for 'outbound_delivery'
  SELECT * INTO v_config FROM document_id_config
  WHERE company_id = p_company_id AND document_type = 'outbound_delivery'
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO document_id_config (company_id, document_type, prefix, num_digits, starting_number)
    VALUES (p_company_id, 'outbound_delivery', 'OD', 4, 1)
    RETURNING * INTO v_config;
  END IF;

  -- Get current max number from existing deliveries
  SELECT COALESCE(MAX(
    NULLIF(regexp_replace(delivery_number, '[^0-9]', '', 'g'), '')::INTEGER
  ), v_config.starting_number - 1)
  INTO v_current_max
  FROM outbound_deliveries
  WHERE company_id = p_company_id;

  v_next_number := v_current_max + 1;
  v_formatted := v_config.prefix || LPAD(v_next_number::TEXT, v_config.num_digits, '0');

  RETURN v_formatted;
END;
$$;