-- First drop all existing INSERT policies on companies to clean slate
DROP POLICY IF EXISTS "Authenticated users can create companies" ON public.companies;
DROP POLICY IF EXISTS "Users can create companies" ON public.companies;

-- Create a simple, permissive INSERT policy for authenticated users
CREATE POLICY "Authenticated users can create companies"
ON public.companies
FOR INSERT
TO authenticated
WITH CHECK (true);