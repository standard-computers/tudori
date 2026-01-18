-- Create product_uoms table for additional units of measure
CREATE TABLE public.product_uoms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  abbreviation TEXT,
  conversion_factor NUMERIC(10,4) NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, name)
);

-- Enable RLS
ALTER TABLE public.product_uoms ENABLE ROW LEVEL SECURITY;

-- RLS Policies - inherit from product's company
CREATE POLICY "Users can view UOMs for products in their company"
ON public.product_uoms FOR SELECT
USING (
  product_id IN (
    SELECT id FROM public.products 
    WHERE company_id = get_user_company_id(auth.uid())
  )
);

CREATE POLICY "Admins can create UOMs"
ON public.product_uoms FOR INSERT
WITH CHECK (
  product_id IN (
    SELECT id FROM public.products 
    WHERE is_company_admin(auth.uid(), company_id)
  )
);

CREATE POLICY "Admins can update UOMs"
ON public.product_uoms FOR UPDATE
USING (
  product_id IN (
    SELECT id FROM public.products 
    WHERE is_company_admin(auth.uid(), company_id)
  )
);

CREATE POLICY "Admins can delete UOMs"
ON public.product_uoms FOR DELETE
USING (
  product_id IN (
    SELECT id FROM public.products 
    WHERE is_company_admin(auth.uid(), company_id)
  )
);