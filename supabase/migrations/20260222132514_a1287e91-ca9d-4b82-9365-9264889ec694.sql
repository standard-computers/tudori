
-- Fix conversations SELECT policy to also allow creators to see their conversations
-- (needed because participants haven't been added yet when the creator first inserts)
DROP POLICY IF EXISTS "Users can view conversations they participate in" ON public.conversations;

CREATE POLICY "Users can view conversations they participate in"
ON public.conversations
FOR SELECT
USING (
  created_by = auth.uid()
  OR public.is_conversation_member(id, auth.uid())
);
