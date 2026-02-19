CREATE POLICY "Users can delete material movements in their company"
ON public.material_movements
FOR DELETE
USING (company_id IN (
  SELECT profiles.company_id
  FROM profiles
  WHERE profiles.user_id = auth.uid()
));