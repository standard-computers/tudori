-- Update the function to assign 'it' role instead of 'owner'
CREATE OR REPLACE FUNCTION public.create_company_and_profile(
  p_company_name TEXT,
  p_industry TEXT,
  p_size TEXT,
  p_address_line1 TEXT,
  p_address_line2 TEXT,
  p_city TEXT,
  p_state TEXT,
  p_postal_code TEXT,
  p_country TEXT,
  p_first_name TEXT,
  p_last_name TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_company_id UUID;
  v_result JSON;
BEGIN
  -- Get the authenticated user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Check if user already has a profile
  IF EXISTS (SELECT 1 FROM profiles WHERE user_id = v_user_id) THEN
    RAISE EXCEPTION 'User already has a profile';
  END IF;
  
  -- Create the company
  INSERT INTO companies (name, industry, size, address_line1, address_line2, city, state, postal_code, country)
  VALUES (p_company_name, p_industry, p_size, p_address_line1, p_address_line2, p_city, p_state, p_postal_code, p_country)
  RETURNING id INTO v_company_id;
  
  -- Create the profile
  INSERT INTO profiles (user_id, company_id, first_name, last_name)
  VALUES (v_user_id, v_company_id, p_first_name, p_last_name);
  
  -- Assign IT role (has admin privileges per is_company_admin function)
  INSERT INTO user_roles (user_id, company_id, role)
  VALUES (v_user_id, v_company_id, 'it');
  
  -- Return the company id
  v_result := json_build_object('company_id', v_company_id);
  RETURN v_result;
END;
$$;