CREATE OR REPLACE FUNCTION internal.get_next_product_id(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_config document_id_config%ROWTYPE;
  v_next_number INTEGER;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid() AND company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'Access denied: User does not belong to this company';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_company_id::text || ':product'));

  SELECT * INTO v_config
  FROM document_id_config
  WHERE company_id = p_company_id AND document_type = 'product';

  IF NOT FOUND THEN
    INSERT INTO document_id_config (company_id, document_type, prefix, starting_number, num_digits)
    VALUES (p_company_id, 'product', '', 1, 4)
    RETURNING * INTO v_config;
  END IF;

  SELECT COALESCE(MAX(
    CASE
      WHEN product_id ~ ('^' || COALESCE(v_config.prefix, '') || '[0-9]+$')
      THEN CAST(SUBSTRING(product_id FROM LENGTH(COALESCE(v_config.prefix, '')) + 1) AS INTEGER)
      ELSE 0
    END
  ), COALESCE(v_config.starting_number, 1) - 1) + 1
  INTO v_next_number
  FROM products
  WHERE company_id = p_company_id;

  RETURN COALESCE(v_config.prefix, '') || LPAD(v_next_number::TEXT, COALESCE(v_config.num_digits, 4), '0');
END;
$function$;