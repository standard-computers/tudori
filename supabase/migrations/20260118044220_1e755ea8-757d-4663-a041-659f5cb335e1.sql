-- Create purchase_orders table
CREATE TABLE public.purchase_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  po_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  requisition_id UUID REFERENCES public.requisitions(id) ON DELETE SET NULL,
  subtotal NUMERIC(12,2) DEFAULT 0,
  tax_amount NUMERIC(12,2) DEFAULT 0,
  total_amount NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  order_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expected_delivery_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, po_number)
);

-- Create purchase_order_items table
CREATE TABLE public.purchase_order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity NUMERIC(12,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2),
  total_price NUMERIC(12,2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for purchase_orders
CREATE POLICY "Users can view purchase orders from their company"
ON public.purchase_orders
FOR SELECT
USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Admins can insert purchase orders for their company"
ON public.purchase_orders
FOR INSERT
WITH CHECK (
  company_id = public.get_user_company_id(auth.uid())
  AND public.is_company_admin(auth.uid(), company_id)
);

CREATE POLICY "Admins can update purchase orders for their company"
ON public.purchase_orders
FOR UPDATE
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND public.is_company_admin(auth.uid(), company_id)
);

CREATE POLICY "Admins can delete purchase orders for their company"
ON public.purchase_orders
FOR DELETE
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND public.is_company_admin(auth.uid(), company_id)
);

-- RLS policies for purchase_order_items
CREATE POLICY "Users can view purchase order items from their company"
ON public.purchase_order_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_id
    AND po.company_id = public.get_user_company_id(auth.uid())
  )
);

CREATE POLICY "Admins can insert purchase order items"
ON public.purchase_order_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_id
    AND po.company_id = public.get_user_company_id(auth.uid())
    AND public.is_company_admin(auth.uid(), po.company_id)
  )
);

CREATE POLICY "Admins can update purchase order items"
ON public.purchase_order_items
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_id
    AND po.company_id = public.get_user_company_id(auth.uid())
    AND public.is_company_admin(auth.uid(), po.company_id)
  )
);

CREATE POLICY "Admins can delete purchase order items"
ON public.purchase_order_items
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_id
    AND po.company_id = public.get_user_company_id(auth.uid())
    AND public.is_company_admin(auth.uid(), po.company_id)
  )
);

-- Function to get next PO number
CREATE OR REPLACE FUNCTION public.get_next_po_number(p_company_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(po_number FROM 4) AS INTEGER)), 0) + 1
  INTO next_num
  FROM public.purchase_orders
  WHERE company_id = p_company_id;
  
  RETURN 'PO-' || LPAD(next_num::TEXT, 4, '0');
END;
$$;