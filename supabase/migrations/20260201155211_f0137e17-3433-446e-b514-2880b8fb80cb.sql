-- Add document_id_config entries for Carriers, Routes, and Assignments
INSERT INTO public.document_id_config (company_id, document_type, prefix, starting_number, num_digits)
SELECT id, 'carrier', 'CAR-', 1, 4 FROM public.companies
ON CONFLICT DO NOTHING;

INSERT INTO public.document_id_config (company_id, document_type, prefix, starting_number, num_digits)
SELECT id, 'route', 'RTE-', 1, 4 FROM public.companies
ON CONFLICT DO NOTHING;

INSERT INTO public.document_id_config (company_id, document_type, prefix, starting_number, num_digits)
SELECT id, 'assignment', 'ASN-', 1, 4 FROM public.companies
ON CONFLICT DO NOTHING;

-- Create function to generate carrier IDs
CREATE OR REPLACE FUNCTION public.generate_carrier_id(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text;
  v_num_digits integer;
  v_next_number integer;
  v_max_number integer;
BEGIN
  -- Get config for this company
  SELECT prefix, num_digits INTO v_prefix, v_num_digits
  FROM document_id_config
  WHERE company_id = p_company_id AND document_type = 'carrier';

  -- Use defaults if no config exists
  IF v_prefix IS NULL THEN
    v_prefix := 'CAR-';
    v_num_digits := 4;
  END IF;

  -- Get the max existing number for this company
  SELECT COALESCE(MAX(
    CASE 
      WHEN carrier_id ~ ('^' || v_prefix || '[0-9]+$')
      THEN CAST(SUBSTRING(carrier_id FROM LENGTH(v_prefix) + 1) AS integer)
      ELSE 0
    END
  ), 0) INTO v_max_number
  FROM carriers
  WHERE company_id = p_company_id;

  v_next_number := v_max_number + 1;

  RETURN v_prefix || LPAD(v_next_number::text, v_num_digits, '0');
END;
$$;

-- Create function to generate route IDs
CREATE OR REPLACE FUNCTION public.generate_route_id(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text;
  v_num_digits integer;
  v_next_number integer;
  v_max_number integer;
BEGIN
  -- Get config for this company
  SELECT prefix, num_digits INTO v_prefix, v_num_digits
  FROM document_id_config
  WHERE company_id = p_company_id AND document_type = 'route';

  -- Use defaults if no config exists
  IF v_prefix IS NULL THEN
    v_prefix := 'RTE-';
    v_num_digits := 4;
  END IF;

  -- Get the max existing number for this company
  SELECT COALESCE(MAX(
    CASE 
      WHEN route_id ~ ('^' || v_prefix || '[0-9]+$')
      THEN CAST(SUBSTRING(route_id FROM LENGTH(v_prefix) + 1) AS integer)
      ELSE 0
    END
  ), 0) INTO v_max_number
  FROM routes
  WHERE company_id = p_company_id;

  v_next_number := v_max_number + 1;

  RETURN v_prefix || LPAD(v_next_number::text, v_num_digits, '0');
END;
$$;

-- Create function to generate assignment IDs
CREATE OR REPLACE FUNCTION public.generate_assignment_id(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text;
  v_num_digits integer;
  v_next_number integer;
  v_max_number integer;
BEGIN
  -- Get config for this company
  SELECT prefix, num_digits INTO v_prefix, v_num_digits
  FROM document_id_config
  WHERE company_id = p_company_id AND document_type = 'assignment';

  -- Use defaults if no config exists
  IF v_prefix IS NULL THEN
    v_prefix := 'ASN-';
    v_num_digits := 4;
  END IF;

  -- Get the max existing number for this company
  SELECT COALESCE(MAX(
    CASE 
      WHEN assignment_id ~ ('^' || v_prefix || '[0-9]+$')
      THEN CAST(SUBSTRING(assignment_id FROM LENGTH(v_prefix) + 1) AS integer)
      ELSE 0
    END
  ), 0) INTO v_max_number
  FROM assignments
  WHERE company_id = p_company_id;

  v_next_number := v_max_number + 1;

  RETURN v_prefix || LPAD(v_next_number::text, v_num_digits, '0');
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.generate_carrier_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_route_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_assignment_id(uuid) TO authenticated;