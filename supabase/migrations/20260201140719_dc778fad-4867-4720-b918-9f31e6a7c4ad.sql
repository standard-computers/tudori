-- Fix conversation_participants SELECT policy (was referencing itself incorrectly)
DROP POLICY IF EXISTS "Users can view participants of their conversations" ON public.conversation_participants;

CREATE POLICY "Users can view participants of their conversations"
ON public.conversation_participants
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM conversation_participants my_cp
    WHERE my_cp.conversation_id = conversation_participants.conversation_id
      AND my_cp.user_id = auth.uid()
  )
);

-- Fix conversations SELECT policy (was referencing wrong column)
DROP POLICY IF EXISTS "Users can view conversations they participate in" ON public.conversations;

CREATE POLICY "Users can view conversations they participate in"
ON public.conversations
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM conversation_participants cp
    WHERE cp.conversation_id = conversations.id
      AND cp.user_id = auth.uid()
  )
);