-- Drop existing restrictive policies on requisitions
DROP POLICY IF EXISTS "Admins can insert requisitions" ON requisitions;
DROP POLICY IF EXISTS "Admins can update requisitions" ON requisitions;
DROP POLICY IF EXISTS "Admins can delete requisitions" ON requisitions;

-- Create new policies allowing any company member to manage requisitions
CREATE POLICY "Company members can insert requisitions" 
ON requisitions FOR INSERT 
WITH CHECK (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Company members can update requisitions" 
ON requisitions FOR UPDATE 
USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Company members can delete requisitions" 
ON requisitions FOR DELETE 
USING (company_id = get_user_company_id(auth.uid()));

-- Drop existing restrictive policies on requisition_items
DROP POLICY IF EXISTS "Admins can insert requisition items" ON requisition_items;
DROP POLICY IF EXISTS "Admins can update requisition items" ON requisition_items;
DROP POLICY IF EXISTS "Admins can delete requisition items" ON requisition_items;

-- Create new policies allowing any company member to manage requisition items
CREATE POLICY "Company members can insert requisition items" 
ON requisition_items FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM requisitions r 
  WHERE r.id = requisition_items.requisition_id 
  AND r.company_id = get_user_company_id(auth.uid())
));

CREATE POLICY "Company members can update requisition items" 
ON requisition_items FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM requisitions r 
  WHERE r.id = requisition_items.requisition_id 
  AND r.company_id = get_user_company_id(auth.uid())
));

CREATE POLICY "Company members can delete requisition items" 
ON requisition_items FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM requisitions r 
  WHERE r.id = requisition_items.requisition_id 
  AND r.company_id = get_user_company_id(auth.uid())
));