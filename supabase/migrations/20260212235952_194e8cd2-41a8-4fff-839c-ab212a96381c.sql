
-- Create a security definer function to safely get user email
CREATE OR REPLACE FUNCTION public.get_auth_email(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM auth.users WHERE id = _user_id LIMIT 1
$$;

-- Drop and recreate the problematic policies
DROP POLICY IF EXISTS "Authenticated users can check their own invitations" ON public.invitations;
DROP POLICY IF EXISTS "Users can mark their own invitation accepted" ON public.invitations;

CREATE POLICY "Authenticated users can check their own invitations"
ON public.invitations
FOR SELECT
TO authenticated
USING (
  email = get_auth_email(auth.uid())
  AND accepted_at IS NULL
  AND expires_at > now()
);

CREATE POLICY "Users can mark their own invitation accepted"
ON public.invitations
FOR UPDATE
TO authenticated
USING (
  email = get_auth_email(auth.uid())
  AND accepted_at IS NULL
);
