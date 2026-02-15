
-- Table to store which products are available at each POS location
CREATE TABLE public.pos_location_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(location_id, product_id)
);

ALTER TABLE public.pos_location_products ENABLE ROW LEVEL SECURITY;

-- Users can view POS products for locations in their company
CREATE POLICY "Users can view POS location products"
ON public.pos_location_products
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM locations l
    JOIN profiles p ON p.company_id = l.company_id
    WHERE l.id = pos_location_products.location_id AND p.user_id = auth.uid()
  )
);

-- Location admins can manage POS products
CREATE POLICY "Location admins can insert POS location products"
ON public.pos_location_products
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM location_users lu
    WHERE lu.location_id = pos_location_products.location_id
    AND lu.user_id = auth.uid()
    AND lu.role = 'admin'
  )
  OR
  EXISTS (
    SELECT 1 FROM locations l
    JOIN user_roles ur ON ur.company_id = l.company_id AND ur.user_id = auth.uid()
    WHERE l.id = pos_location_products.location_id
    AND ur.role IN ('owner', 'admin')
  )
);

CREATE POLICY "Location admins can delete POS location products"
ON public.pos_location_products
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM location_users lu
    WHERE lu.location_id = pos_location_products.location_id
    AND lu.user_id = auth.uid()
    AND lu.role = 'admin'
  )
  OR
  EXISTS (
    SELECT 1 FROM locations l
    JOIN user_roles ur ON ur.company_id = l.company_id AND ur.user_id = auth.uid()
    WHERE l.id = pos_location_products.location_id
    AND ur.role IN ('owner', 'admin')
  )
);
