-- Restrict developer_keys SELECT to admins only
DROP POLICY IF EXISTS "Users can view their company developer keys" ON public.developer_keys;

CREATE POLICY "Admins can view developer keys"
ON public.developer_keys
FOR SELECT
USING (
  company_id = (SELECT profiles.company_id FROM profiles WHERE profiles.user_id = auth.uid())
  AND is_company_admin(auth.uid(), company_id)
);

-- Add UPDATE policy for outbound_delivery_items mirroring existing company-scoped policies
CREATE POLICY "Users can update outbound delivery items via company"
ON public.outbound_delivery_items
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM outbound_deliveries od
    JOIN profiles p ON p.company_id = od.company_id
    WHERE od.id = outbound_delivery_items.outbound_delivery_id
      AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM outbound_deliveries od
    JOIN profiles p ON p.company_id = od.company_id
    WHERE od.id = outbound_delivery_items.outbound_delivery_id
      AND p.user_id = auth.uid()
  )
);