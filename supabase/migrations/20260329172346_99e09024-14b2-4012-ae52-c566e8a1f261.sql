-- Fix 2: Create a SECURITY DEFINER function to check if a company has any roles (bypasses RLS)
CREATE OR REPLACE FUNCTION public.company_has_roles(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE company_id = p_company_id
  )
$$;

-- Drop and recreate the INSERT policy with the safe helper
DROP POLICY IF EXISTS "Users can assign their own role" ON public.user_roles;

CREATE POLICY "Users can assign their own role"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (
    NOT company_has_roles(company_id)
    OR is_company_admin(auth.uid(), company_id)
  )
);