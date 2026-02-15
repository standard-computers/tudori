
-- =============================================
-- FIX 1: Remove plaintext temp_password storage
-- =============================================

-- Clear all existing temp passwords from the invitations table
UPDATE public.invitations SET temp_password = NULL;

-- =============================================
-- FIX 2: Tighten product-images storage policies
-- =============================================

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete product images" ON storage.objects;

-- Create company-scoped policies
CREATE POLICY "Users can upload their company product images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM public.profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their company product images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM public.profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their company product images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM public.profiles WHERE user_id = auth.uid()
  )
);
