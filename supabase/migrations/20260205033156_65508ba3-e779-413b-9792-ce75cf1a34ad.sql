-- Drop the existing INSERT policy
DROP POLICY IF EXISTS "Authenticated users can create companies" ON public.companies;

-- Create a new INSERT policy using public role with explicit auth check
-- This pattern is more reliable in Supabase
CREATE POLICY "Authenticated users can create companies"
ON public.companies
FOR INSERT
TO public
WITH CHECK (auth.uid() IS NOT NULL);