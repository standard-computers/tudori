CREATE OR REPLACE FUNCTION public.is_sole_company_user(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL
     AND _company_id IS NOT NULL
     AND (SELECT COUNT(*) FROM public.profiles p WHERE p.company_id = _company_id) = 1
     AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.company_id = _company_id AND p.id = _user_id)
$$;

GRANT EXECUTE ON FUNCTION public.is_sole_company_user(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _company_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_sole_company_user(_user_id, _company_id)
      OR EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND company_id = _company_id
          AND role = _role
      )
$$;

CREATE OR REPLACE FUNCTION public.is_company_admin(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_sole_company_user(_user_id, _company_id)
      OR EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND company_id = _company_id
          AND role IN ('owner', 'admin', 'it')
      )
$$;

CREATE OR REPLACE FUNCTION public.is_company_it(p_user_id uuid, p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_sole_company_user(p_user_id, p_company_id)
      OR EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = p_user_id
          AND company_id = p_company_id
          AND role = 'it'
      )
$$;