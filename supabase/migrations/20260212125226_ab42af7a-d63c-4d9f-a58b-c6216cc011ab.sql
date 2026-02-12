-- Fix company_settings policies to allow owner/admin/it roles (not just IT)
DROP POLICY "IT can insert their company settings" ON public.company_settings;
DROP POLICY "IT can update their company settings" ON public.company_settings;

CREATE POLICY "Admins can insert their company settings"
ON public.company_settings
FOR INSERT
WITH CHECK (
  company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid())
  AND is_company_admin(auth.uid(), company_id)
);

CREATE POLICY "Admins can update their company settings"
ON public.company_settings
FOR UPDATE
USING (
  company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid())
  AND is_company_admin(auth.uid(), company_id)
);