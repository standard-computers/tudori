-- Drop the overly permissive SELECT policy
DROP POLICY "Admins can view company invitations" ON public.invitations;

-- Create a new SELECT policy that only allows owner, admin, or IT roles
CREATE POLICY "Admins can view company invitations" 
ON public.invitations 
FOR SELECT 
TO authenticated
USING (
  is_company_admin(auth.uid(), company_id)
);