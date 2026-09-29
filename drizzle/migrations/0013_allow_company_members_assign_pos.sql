DROP POLICY "Users assign themselves to POS" ON public.pos_assignments;
CREATE POLICY "Company members assign POS"
ON public.pos_assignments
FOR INSERT
TO authenticated
WITH CHECK (company_id = get_user_company_id(auth.uid()));