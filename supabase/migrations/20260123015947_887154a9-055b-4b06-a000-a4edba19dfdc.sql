-- Add invite_token column for secure invitation lookup
ALTER TABLE public.invitations 
ADD COLUMN IF NOT EXISTS invite_token TEXT UNIQUE DEFAULT gen_random_uuid()::text;

-- Create index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_invitations_invite_token ON public.invitations(invite_token);

-- Drop the overly permissive anonymous SELECT policy
DROP POLICY IF EXISTS "Anyone can check their own invitation by email" ON public.invitations;

-- Create a more restrictive policy that requires either:
-- 1. The user is authenticated and checking their own email, OR
-- 2. They have a valid invite token (passed via RPC or checked via edge function)
-- For now, we restrict anon access to only work with invite_token
CREATE POLICY "Authenticated users can check their own invitations"
ON public.invitations FOR SELECT TO authenticated
USING (
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
  AND accepted_at IS NULL 
  AND expires_at > now()
);

-- Create policy for users to mark their own invitation as accepted
CREATE POLICY "Users can mark their own invitation accepted"
ON public.invitations FOR UPDATE TO authenticated
USING (
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
  AND accepted_at IS NULL
)
WITH CHECK (
  accepted_at IS NOT NULL
);