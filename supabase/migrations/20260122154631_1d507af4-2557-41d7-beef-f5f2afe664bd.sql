-- Allow unauthenticated users to check for their own pending invitations by email
-- This is needed during signup to check if user has been invited
CREATE POLICY "Anyone can check their own invitation by email"
ON public.invitations
FOR SELECT
TO anon
USING (
  accepted_at IS NULL 
  AND expires_at > now()
);