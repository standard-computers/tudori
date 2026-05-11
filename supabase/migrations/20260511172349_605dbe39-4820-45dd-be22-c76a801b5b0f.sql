
-- Revoke direct SELECT on the most sensitive columns
REVOKE SELECT (social_id, wage, gender, ethnicity) ON public.employees FROM authenticated;
REVOKE SELECT (social_id, wage, gender, ethnicity) ON public.employees FROM anon;

-- Helper: returns sensitive fields for a single employee. Admins of that
-- employee's company OR the employee themselves can read.
CREATE OR REPLACE FUNCTION public.get_employee_sensitive(p_employee_id uuid)
RETURNS TABLE (
  id uuid,
  social_id text,
  wage numeric,
  gender text,
  ethnicity text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company uuid;
  v_user uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT e.company_id, e.user_id INTO v_company, v_user
  FROM public.employees e WHERE e.id = p_employee_id;

  IF v_company IS NULL THEN
    RETURN;
  END IF;

  IF NOT (public.is_company_admin(auth.uid(), v_company) OR v_user = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
    SELECT e.id, e.social_id, e.wage, e.gender, e.ethnicity
    FROM public.employees e WHERE e.id = p_employee_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_employee_sensitive(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_employee_sensitive(uuid) TO authenticated;

-- Helper: returns sensitive fields for all employees in a company. Admins only.
CREATE OR REPLACE FUNCTION public.list_employee_sensitive(p_company_id uuid)
RETURNS TABLE (
  id uuid,
  social_id text,
  wage numeric,
  gender text,
  ethnicity text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_company_admin(auth.uid(), p_company_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
    SELECT e.id, e.social_id, e.wage, e.gender, e.ethnicity
    FROM public.employees e
    WHERE e.company_id = p_company_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.list_employee_sensitive(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.list_employee_sensitive(uuid) TO authenticated;
