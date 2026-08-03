ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_company_id_key;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_company_id_role_key UNIQUE (user_id, company_id, role);

CREATE OR REPLACE FUNCTION public.create_company_and_profile(p_company_name text, p_industry text, p_size text, p_address_line1 text, p_address_line2 text, p_city text, p_state text, p_postal_code text, p_country text, p_first_name text, p_last_name text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_company_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT company_id INTO v_company_id FROM profiles WHERE user_id = v_user_id;

  IF EXISTS (SELECT 1 FROM profiles WHERE user_id = v_user_id) AND v_company_id IS NOT NULL THEN
    RAISE EXCEPTION 'User already belongs to a company';
  END IF;

  INSERT INTO companies (name, industry, size, address_line1, address_line2, city, state, postal_code, country)
  VALUES (p_company_name, p_industry, p_size, p_address_line1, p_address_line2, p_city, p_state, p_postal_code, p_country)
  RETURNING id INTO v_company_id;

  IF EXISTS (SELECT 1 FROM profiles WHERE user_id = v_user_id) THEN
    UPDATE profiles
       SET company_id = v_company_id,
           first_name = p_first_name,
           last_name = p_last_name
     WHERE user_id = v_user_id;
  ELSE
    INSERT INTO profiles (user_id, company_id, first_name, last_name)
    VALUES (v_user_id, v_company_id, p_first_name, p_last_name);
  END IF;

  INSERT INTO user_roles (user_id, company_id, role)
  VALUES (v_user_id, v_company_id, 'owner'), (v_user_id, v_company_id, 'it')
  ON CONFLICT (user_id, company_id, role) DO NOTHING;

  RETURN json_build_object('company_id', v_company_id);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_company_and_profile(text,text,text,text,text,text,text,text,text,text,text) TO authenticated;