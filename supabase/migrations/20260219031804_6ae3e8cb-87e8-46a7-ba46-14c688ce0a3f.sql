-- Add missing DELETE policy for payments table
CREATE POLICY "Users can delete payments in their company"
ON public.payments
FOR DELETE
USING (company_id IN (
  SELECT profiles.company_id
  FROM profiles
  WHERE profiles.user_id = auth.uid()
));