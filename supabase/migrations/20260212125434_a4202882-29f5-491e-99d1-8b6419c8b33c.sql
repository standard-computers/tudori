-- Fix document_id_config policies to allow owner/admin/it roles
DROP POLICY "IT can insert their company's document config" ON public.document_id_config;
DROP POLICY "IT can update their company's document config" ON public.document_id_config;
DROP POLICY "IT can delete their company's document config" ON public.document_id_config;

CREATE POLICY "Admins can insert their company's document config"
ON public.document_id_config
FOR INSERT
WITH CHECK (
  company_id = get_user_company_id(auth.uid())
  AND is_company_admin(auth.uid(), company_id)
);

CREATE POLICY "Admins can update their company's document config"
ON public.document_id_config
FOR UPDATE
USING (
  company_id = get_user_company_id(auth.uid())
  AND is_company_admin(auth.uid(), company_id)
);

CREATE POLICY "Admins can delete their company's document config"
ON public.document_id_config
FOR DELETE
USING (
  company_id = get_user_company_id(auth.uid())
  AND is_company_admin(auth.uid(), company_id)
);