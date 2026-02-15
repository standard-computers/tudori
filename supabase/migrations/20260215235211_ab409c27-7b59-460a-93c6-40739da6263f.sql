
CREATE POLICY "Users can update location_users for their company's locations"
ON public.location_users
FOR UPDATE
TO authenticated
USING (
  location_id IN (
    SELECT id FROM locations WHERE company_id = get_user_company_id(auth.uid())
  )
)
WITH CHECK (
  location_id IN (
    SELECT id FROM locations WHERE company_id = get_user_company_id(auth.uid())
  )
);
