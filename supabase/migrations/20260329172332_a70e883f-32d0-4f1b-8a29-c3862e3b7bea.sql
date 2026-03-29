-- Fix 1: Recreate customers_safe view with SECURITY INVOKER so it inherits caller's RLS context
DROP VIEW IF EXISTS public.customers_safe;

CREATE VIEW public.customers_safe
WITH (security_invoker = true)
AS
SELECT
  id,
  customer_id,
  name,
  type,
  company_id,
  CASE WHEN is_company_admin(auth.uid(), company_id) THEN email ELSE NULL::text END AS email,
  CASE WHEN is_company_admin(auth.uid(), company_id) THEN phone ELSE NULL::text END AS phone,
  CASE WHEN is_company_admin(auth.uid(), company_id) THEN contact_name ELSE NULL::text END AS contact_name,
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