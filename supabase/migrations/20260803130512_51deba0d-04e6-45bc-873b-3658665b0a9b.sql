-- Make onboarding self-contained and audit-proof.
-- Both onboarding paths now run inside SECURITY DEFINER functions so they no longer
-- depend on client-side insert policies that security hardening passes tighten.

CREATE OR REPLACE FUNCTION public.create_company_and_profile(
  p_company_name text,
  p_industry text,
  p_size text,
  p_address_line1 text,
  p_address_line2 text,
  p_city text,
  p_state text,
  p_postal_code text,
  p_country text,
  p_first_name text,
  p_last_name text
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN json_build_object('company_id', v_company_id);
END;
$$;

-- Onboarding + RLS helper functions MUST remain executable by `authenticated`.
-- Revoking these breaks signup / company creation and RLS policy evaluation.
GRANT EXECUTE ON FUNCTION public.create_company_and_profile(text,text,text,text,text,text,text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_company_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_company_it(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_company_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.company_has_roles(uuid) TO authenticated;