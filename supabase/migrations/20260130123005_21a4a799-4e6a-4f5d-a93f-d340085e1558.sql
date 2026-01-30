-- Create product_safety_stock table to store safety stock levels per product per location
CREATE TABLE public.product_safety_stock (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  safety_stock_quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, location_id)
);

-- Enable RLS
ALTER TABLE public.product_safety_stock ENABLE ROW LEVEL SECURITY;

-- Create RLS policies based on company access through products
CREATE POLICY "Users can view safety stock for their company products"
ON public.product_safety_stock
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.profiles pr ON pr.company_id = p.company_id
    WHERE p.id = product_safety_stock.product_id
    AND pr.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert safety stock for their company products"
ON public.product_safety_stock
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.profiles pr ON pr.company_id = p.company_id
    WHERE p.id = product_safety_stock.product_id
    AND pr.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update safety stock for their company products"
ON public.product_safety_stock
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.profiles pr ON pr.company_id = p.company_id
    WHERE p.id = product_safety_stock.product_id
    AND pr.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete safety stock for their company products"
ON public.product_safety_stock
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.profiles pr ON pr.company_id = p.company_id
    WHERE p.id = product_safety_stock.product_id
    AND pr.user_id = auth.uid()
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_product_safety_stock_updated_at
BEFORE UPDATE ON public.product_safety_stock
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();