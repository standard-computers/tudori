-- Fix the profiles SELECT policy to allow users to always see their own profile
DROP POLICY IF EXISTS "Users can view profiles in their company" ON public.profiles;

CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (
  user_id = auth.uid()
);

CREATE POLICY "Users can view profiles in same company"
ON public.profiles
FOR SELECT
USING (
  company_id IS NOT NULL 
  AND company_id = public.get_user_company_id(auth.uid())
);