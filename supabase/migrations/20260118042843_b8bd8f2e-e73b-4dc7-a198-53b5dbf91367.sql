-- Create requisitions table
CREATE TABLE public.requisitions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  requisition_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  notes TEXT,
  total_amount NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, requisition_id)
);

-- Create requisition_items table
CREATE TABLE public.requisition_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requisition_id UUID NOT NULL REFERENCES public.requisitions(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requisition_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for requisitions
CREATE POLICY "Users can view requisitions in their company" 
ON public.requisitions FOR SELECT 
USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Admins can insert requisitions" 
ON public.requisitions FOR INSERT 
WITH CHECK (public.is_company_admin(auth.uid(), company_id));

CREATE POLICY "Admins can update requisitions" 
ON public.requisitions FOR UPDATE 
USING (public.is_company_admin(auth.uid(), company_id));

CREATE POLICY "Admins can delete requisitions" 
ON public.requisitions FOR DELETE 
USING (public.is_company_admin(auth.uid(), company_id));

-- RLS policies for requisition_items (using table-qualified column reference)
CREATE POLICY "Users can view requisition items in their company" 
ON public.requisition_items FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.requisitions r 
  WHERE r.id = requisition_items.requisition_id 
  AND r.company_id = public.get_user_company_id(auth.uid())
));

CREATE POLICY "Admins can insert requisition items" 
ON public.requisition_items FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.requisitions r 
  WHERE r.id = requisition_items.requisition_id 
  AND public.is_company_admin(auth.uid(), r.company_id)
));

CREATE POLICY "Admins can update requisition items" 
ON public.requisition_items FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.requisitions r 
  WHERE r.id = requisition_items.requisition_id 
  AND public.is_company_admin(auth.uid(), r.company_id)
));

CREATE POLICY "Admins can delete requisition items" 
ON public.requisition_items FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM public.requisitions r 
  WHERE r.id = requisition_items.requisition_id 
  AND public.is_company_admin(auth.uid(), r.company_id)
));

-- Function to get next requisition ID
CREATE OR REPLACE FUNCTION public.get_next_requisition_id(p_company_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(requisition_id AS INTEGER)), 0) + 1
  INTO next_num
  FROM public.requisitions
  WHERE company_id = p_company_id;
  
  RETURN LPAD(next_num::TEXT, 4, '0');
END;
$$;

-- Create trigger for updated_at
CREATE TRIGGER update_requisitions_updated_at
BEFORE UPDATE ON public.requisitions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();