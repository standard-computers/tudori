-- Drop the restrictive policy and recreate as permissive
DROP POLICY IF EXISTS "Authenticated users can create companies" ON public.companies;

CREATE POLICY "Authenticated users can create companies"
ON public.companies
FOR INSERT
TO authenticated
WITH CHECK (true);