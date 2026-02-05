-- Drop the existing INSERT policy
DROP POLICY IF EXISTS "Authenticated users can create companies" ON public.companies;

-- Create a new INSERT policy that explicitly checks for authenticated users
CREATE POLICY "Authenticated users can create companies"
ON public.companies
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Also need to allow new users to insert their own profile during onboarding
-- The current profile insert policy checks (auth.uid() = user_id) which is correct

-- Fix user_roles: new company owners need to assign themselves the owner role
-- But current policy requires is_company_admin which they won't have yet
DROP POLICY IF EXISTS "Admins can add user roles" ON public.user_roles;

-- Allow users to insert their own role when creating a new company (self-assignment)
CREATE POLICY "Users can assign their own role"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() AND (
    -- Either they're assigning themselves to a company they just created (no existing admin)
    NOT EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.company_id = user_roles.company_id
    )
    -- Or they're an admin of the company
    OR is_company_admin(auth.uid(), company_id)
  )
);