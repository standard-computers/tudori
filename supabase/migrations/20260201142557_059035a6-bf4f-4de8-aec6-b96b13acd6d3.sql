-- Drop the existing INSERT policy that's not working
DROP POLICY IF EXISTS "Authenticated users can create companies" ON public.companies;

-- Create a proper INSERT policy for authenticated users
CREATE POLICY "Authenticated users can create companies"
ON public.companies
FOR INSERT
TO authenticated
WITH CHECK (true);