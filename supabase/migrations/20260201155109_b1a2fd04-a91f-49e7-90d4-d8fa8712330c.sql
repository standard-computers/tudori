-- Drop the existing broken RLS policies for carriers
DROP POLICY IF EXISTS "Users can create carriers in their company" ON public.carriers;
DROP POLICY IF EXISTS "Users can delete carriers in their company" ON public.carriers;
DROP POLICY IF EXISTS "Users can update carriers in their company" ON public.carriers;
DROP POLICY IF EXISTS "Users can view carriers in their company" ON public.carriers;

-- Recreate with correct user_id check
CREATE POLICY "Users can view carriers in their company" 
ON public.carriers 
FOR SELECT 
USING (company_id IN ( SELECT profiles.company_id FROM profiles WHERE profiles.user_id = auth.uid()));

CREATE POLICY "Users can create carriers in their company" 
ON public.carriers 
FOR INSERT 
WITH CHECK (company_id IN ( SELECT profiles.company_id FROM profiles WHERE profiles.user_id = auth.uid()));

CREATE POLICY "Users can update carriers in their company" 
ON public.carriers 
FOR UPDATE 
USING (company_id IN ( SELECT profiles.company_id FROM profiles WHERE profiles.user_id = auth.uid()));

CREATE POLICY "Users can delete carriers in their company" 
ON public.carriers 
FOR DELETE 
USING (company_id IN ( SELECT profiles.company_id FROM profiles WHERE profiles.user_id = auth.uid()));