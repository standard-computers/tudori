-- Update get_next_requisition_id to use document_id_config
CREATE OR REPLACE FUNCTION public.get_next_requisition_id(p_company_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_config document_id_config%ROWTYPE;
  v_next_number INTEGER;
  v_formatted_number TEXT;
BEGIN
  -- Validate user belongs to company
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid() AND company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'Access denied: User does not belong to this company';
  END IF;

  -- Get document ID config for requisition
  SELECT * INTO v_config 
  FROM document_id_config 
  WHERE company_id = p_company_id AND document_type = 'requisition';
  
  -- Create default config if not found
  IF NOT FOUND THEN
    INSERT INTO document_id_config (company_id, document_type, prefix, starting_number, num_digits)
    VALUES (p_company_id, 'requisition', 'REQ-', 1, 4)
    RETURNING * INTO v_config;
  END IF;
  
  -- Calculate next number based on existing requisitions with the configured prefix
  SELECT COALESCE(MAX(
    CASE 
      WHEN requisition_id ~ ('^' || COALESCE(v_config.prefix, '') || '[0-9]+$')
      THEN CAST(SUBSTRING(requisition_id FROM LENGTH(COALESCE(v_config.prefix, '')) + 1) AS INTEGER)
      ELSE 0
    END
  ), v_config.starting_number - 1) + 1
  INTO v_next_number
  FROM requisitions
  WHERE company_id = p_company_id;
  
  -- Format the number with prefix and padding
  v_formatted_number := COALESCE(v_config.prefix, '') || LPAD(v_next_number::TEXT, v_config.num_digits, '0');
  
  RETURN v_formatted_number;
END;
$function$;