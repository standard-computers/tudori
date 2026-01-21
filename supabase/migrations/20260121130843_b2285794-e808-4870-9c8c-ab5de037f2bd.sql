-- Create a function to check if user has IT role
CREATE OR REPLACE FUNCTION public.is_company_it(p_user_id uuid, p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = p_user_id
      AND company_id = p_company_id
      AND role = 'it'
  )
$$;

-- Drop existing policies on company_settings that allow admin access
DROP POLICY IF EXISTS "Admins can insert their company settings" ON public.company_settings;
DROP POLICY IF EXISTS "Admins can update their company settings" ON public.company_settings;

-- Create new policies for company_settings - only IT can insert/update
CREATE POLICY "IT can insert their company settings" 
ON public.company_settings 
FOR INSERT 
WITH CHECK (
  (company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.user_id = auth.uid()))
  AND is_company_it(auth.uid(), company_id)
);

CREATE POLICY "IT can update their company settings" 
ON public.company_settings 
FOR UPDATE 
USING (
  (company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.user_id = auth.uid()))
  AND is_company_it(auth.uid(), company_id)
);

-- Drop existing policies on document_id_config
DROP POLICY IF EXISTS "Users can delete their company's document config" ON public.document_id_config;
DROP POLICY IF EXISTS "Users can insert their company's document config" ON public.document_id_config;
DROP POLICY IF EXISTS "Users can update their company's document config" ON public.document_id_config;

-- Create new policies for document_id_config - only IT can modify
CREATE POLICY "IT can insert their company's document config" 
ON public.document_id_config 
FOR INSERT 
WITH CHECK (
  company_id = get_user_company_id(auth.uid())
  AND is_company_it(auth.uid(), company_id)
);

CREATE POLICY "IT can update their company's document config" 
ON public.document_id_config 
FOR UPDATE 
USING (
  company_id = get_user_company_id(auth.uid())
  AND is_company_it(auth.uid(), company_id)
);

CREATE POLICY "IT can delete their company's document config" 
ON public.document_id_config 
FOR DELETE 
USING (
  company_id = get_user_company_id(auth.uid())
  AND is_company_it(auth.uid(), company_id)
);