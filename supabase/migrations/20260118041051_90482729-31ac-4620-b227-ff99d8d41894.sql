-- Create products table
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  product_id TEXT NOT NULL,
  sku TEXT,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  price NUMERIC(10,2),
  unit TEXT DEFAULT 'each',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, product_id),
  UNIQUE(company_id, sku)
);

-- Enable RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view products in their company"
ON public.products FOR SELECT
USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Admins can create products"
ON public.products FOR INSERT
WITH CHECK (is_company_admin(auth.uid(), company_id));

CREATE POLICY "Admins can update products"
ON public.products FOR UPDATE
USING (is_company_admin(auth.uid(), company_id));

CREATE POLICY "Admins can delete products"
ON public.products FOR DELETE
USING (is_company_admin(auth.uid(), company_id));

-- Function to get next product ID
CREATE OR REPLACE FUNCTION public.get_next_product_id(p_company_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(product_id AS INTEGER)), 0) + 1
  INTO next_num
  FROM public.products
  WHERE company_id = p_company_id;
  
  RETURN LPAD(next_num::TEXT, 4, '0');
END;
$$;