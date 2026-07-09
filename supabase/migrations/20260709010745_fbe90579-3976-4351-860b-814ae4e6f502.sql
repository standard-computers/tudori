
-- ============= 1. user_roles bootstrap: only allow 'owner' during bootstrap =============
DROP POLICY IF EXISTS "Users can assign their own role" ON public.user_roles;
CREATE POLICY "Users can assign their own role"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND company_id = get_user_company_id(auth.uid())
  AND (
    (NOT company_has_roles(company_id) AND role = 'owner'::app_role)
    OR is_company_admin(auth.uid(), company_id)
  )
);

-- ============= 2. employee_reviews: restrict to admin, reviewer, or reviewed employee =============
DROP POLICY IF EXISTS "Users can view reviews for their company" ON public.employee_reviews;
DROP POLICY IF EXISTS "Users can insert reviews for their company" ON public.employee_reviews;
DROP POLICY IF EXISTS "Users can update reviews for their company" ON public.employee_reviews;
DROP POLICY IF EXISTS "Users can delete reviews for their company" ON public.employee_reviews;

CREATE POLICY "Admins reviewer or subject can view reviews"
ON public.employee_reviews
FOR SELECT
TO authenticated
USING (
  is_company_admin(auth.uid(), company_id)
  OR reviewer_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = employee_reviews.employee_id
      AND e.user_id = auth.uid()
  )
);

CREATE POLICY "Admins or reviewer can insert reviews"
ON public.employee_reviews
FOR INSERT
TO authenticated
WITH CHECK (
  company_id = get_user_company_id(auth.uid())
  AND (
    is_company_admin(auth.uid(), company_id)
    OR reviewer_id = auth.uid()
  )
);

CREATE POLICY "Admins or reviewer can update reviews"
ON public.employee_reviews
FOR UPDATE
TO authenticated
USING (
  is_company_admin(auth.uid(), company_id)
  OR reviewer_id = auth.uid()
);

CREATE POLICY "Admins can delete reviews"
ON public.employee_reviews
FOR DELETE
TO authenticated
USING (is_company_admin(auth.uid(), company_id));

-- ============= 3. employees: revoke column-level access to sensitive fields =============
-- Strip broad table-level SELECT/UPDATE; grant only non-sensitive columns.
REVOKE SELECT, UPDATE ON public.employees FROM authenticated, anon;

GRANT SELECT (
  id, company_id, employee_id, first_name, last_name, email, phone,
  job_title, department, hire_date, status, notes, created_at, updated_at,
  is_hourly, bonus_eligible, user_id,
  address_line1, address_line2, city, state, postal_code, country
) ON public.employees TO authenticated;

GRANT UPDATE (
  employee_id, first_name, last_name, email, phone,
  job_title, department, hire_date, status, notes,
  is_hourly, bonus_eligible, user_id,
  address_line1, address_line2, city, state, postal_code, country
) ON public.employees TO authenticated;

-- Admin-only RPC to write sensitive employee fields
CREATE OR REPLACE FUNCTION public.upsert_employee_sensitive(
  p_employee_id uuid,
  p_social_id text,
  p_wage numeric,
  p_gender text,
  p_ethnicity text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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
    RAISE EXCEPTION 'Employee not found';
  END IF;

  IF NOT (public.is_company_admin(auth.uid(), v_company) OR v_user = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE public.employees
  SET social_id = p_social_id,
      wage = p_wage,
      gender = p_gender,
      ethnicity = p_ethnicity,
      updated_at = now()
  WHERE id = p_employee_id;
END;
$$;

-- ============= 4. SECURITY DEFINER function grants =============
-- Revoke EXECUTE from anon on all SECURITY DEFINER functions in public schema.
-- Also revoke from authenticated on internal helpers and trigger functions.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM anon, PUBLIC', r.schema, r.proname, r.args);
  END LOOP;
END $$;

-- Revoke authenticated EXECUTE on internal helpers / trigger functions that
-- must not be callable directly by end users.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, uuid, app_role) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_company_admin(uuid, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_company_it(uuid, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_company_id(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.company_has_roles(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_conversation_member(uuid, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_auth_email(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.update_agreements_updated_at() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.log_purchase_order_changes() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.log_sales_order_changes() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.log_location_changes() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.log_customer_changes() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.log_location_user_changes() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.log_agreement_changes() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.log_employee_changes() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.log_requisition_changes() FROM authenticated;

-- Grant EXECUTE on the new admin-only RPC to authenticated (checks are inside).
GRANT EXECUTE ON FUNCTION public.upsert_employee_sensitive(uuid, text, numeric, text, text) TO authenticated;

-- ============= 5. Storage: remove broad public SELECT policies (buckets stay public for direct URLs) =============
DROP POLICY IF EXISTS "Company logos are publicly viewable" ON storage.objects;
DROP POLICY IF EXISTS "Product images are publicly accessible" ON storage.objects;
