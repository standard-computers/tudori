
-- 1) Invoice attachments storage: scope by company folder
DROP POLICY IF EXISTS "Anyone can view invoice attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete invoice attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload invoice attachments" ON storage.objects;

CREATE POLICY "Company members can view invoice attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'invoice-attachments'
    AND (storage.foldername(name))[1] IN (
      SELECT company_id::text FROM public.profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Company members can upload invoice attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'invoice-attachments'
    AND (storage.foldername(name))[1] IN (
      SELECT company_id::text FROM public.profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Company members can delete invoice attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'invoice-attachments'
    AND (storage.foldername(name))[1] IN (
      SELECT company_id::text FROM public.profiles WHERE user_id = auth.uid()
    )
  );

-- Make the bucket private (signed URLs / authenticated reads only)
UPDATE storage.buckets SET public = false WHERE id = 'invoice-attachments';

-- 2) Close user_roles bootstrap escalation: require the user to already
-- belong to the target company (their profile.company_id must match).
DROP POLICY IF EXISTS "Users can assign their own role" ON public.user_roles;

CREATE POLICY "Users can assign their own role"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND company_id = public.get_user_company_id(auth.uid())
    AND (
      NOT public.company_has_roles(company_id)
      OR public.is_company_admin(auth.uid(), company_id)
    )
  );

-- 3) Realtime channel authorization for messages
-- Restrict broadcast/presence subscriptions on conversation topics to participants.
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Conversation members can read realtime messages" ON realtime.messages;
CREATE POLICY "Conversation members can read realtime messages"
  ON realtime.messages FOR SELECT TO authenticated
  USING (
    -- Topic format expected: "messages:<conversation_id>"
    public.is_conversation_member(
      NULLIF(split_part(realtime.topic(), ':', 2), '')::uuid,
      auth.uid()
    )
  );
