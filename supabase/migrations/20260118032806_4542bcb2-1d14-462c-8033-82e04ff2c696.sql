-- Drop the overly permissive policy
DROP POLICY "Users can create companies during signup" ON public.companies;

-- Create a more secure policy that requires authentication
CREATE POLICY "Authenticated users can create companies"
ON public.companies
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);