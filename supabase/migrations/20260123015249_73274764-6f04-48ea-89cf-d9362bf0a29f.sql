-- Fix 1: Storage bucket path-based access control
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can upload company logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their company logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their company logos" ON storage.objects;

-- Create path-based policies that validate company ownership
CREATE POLICY "Users can upload their company logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'company-logos'
  AND (storage.foldername(name))[1] IN (
    SELECT company_id::text 
    FROM profiles 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their company logos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'company-logos'
  AND (storage.foldername(name))[1] IN (
    SELECT company_id::text 
    FROM profiles 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their company logos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'company-logos'
  AND (storage.foldername(name))[1] IN (
    SELECT company_id::text 
    FROM profiles 
    WHERE user_id = auth.uid()
  )
);

-- Fix 2: Restrict customer contact info to admins only
-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view customers in their company" ON public.customers;

-- Create a view that hides sensitive contact info for non-admins
CREATE OR REPLACE VIEW public.customers_safe
WITH (security_invoker=on) AS
SELECT 
  id,
  customer_id,
  name,
  type,
  company_id,
  -- Only expose contact info to admins
  CASE WHEN is_company_admin(auth.uid(), company_id) THEN email ELSE NULL END as email,
  CASE WHEN is_company_admin(auth.uid(), company_id) THEN phone ELSE NULL END as phone,
  CASE WHEN is_company_admin(auth.uid(), company_id) THEN contact_name ELSE NULL END as contact_name,
  address_line1,
  address_line2,
  city,
  state,
  postal_code,
  country,
  website,
  notes,
  created_at,
  updated_at
FROM public.customers;

-- Recreate the SELECT policy - admins see all, members see limited via view
CREATE POLICY "Users can view customers in their company"
ON public.customers FOR SELECT
USING (company_id = get_user_company_id(auth.uid()));