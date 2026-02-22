
-- Create a security definer function to check conversation membership without triggering RLS
CREATE OR REPLACE FUNCTION public.is_conversation_member(_conversation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_participants
    WHERE conversation_id = _conversation_id
      AND user_id = _user_id
  )
$$;

-- Drop the recursive policy on conversation_participants
DROP POLICY IF EXISTS "Users can view participants of their conversations" ON public.conversation_participants;

-- Recreate using the security definer function (no recursion)
CREATE POLICY "Users can view participants of their conversations"
ON public.conversation_participants
FOR SELECT
USING (public.is_conversation_member(conversation_id, auth.uid()));

-- Fix conversations SELECT policy to also use the function
DROP POLICY IF EXISTS "Users can view conversations they participate in" ON public.conversations;

CREATE POLICY "Users can view conversations they participate in"
ON public.conversations
FOR SELECT
USING (public.is_conversation_member(id, auth.uid()));

-- Fix messages SELECT policy (it also had a bug: cp.conversation_id = cp.conversation_id instead of messages.conversation_id)
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.messages;

CREATE POLICY "Users can view messages in their conversations"
ON public.messages
FOR SELECT
USING (public.is_conversation_member(conversation_id, auth.uid()));

-- Fix messages INSERT policy (same bug)
DROP POLICY IF EXISTS "Users can send messages to their conversations" ON public.messages;

CREATE POLICY "Users can send messages to their conversations"
ON public.messages
FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND public.is_conversation_member(conversation_id, auth.uid())
);
