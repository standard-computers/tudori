-- Create product_components table for Bill of Materials
CREATE TABLE public.product_components (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  component_product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(parent_product_id, component_product_id),
  CONSTRAINT no_self_reference CHECK (parent_product_id != component_product_id)
);

-- Enable RLS
ALTER TABLE public.product_components ENABLE ROW LEVEL SECURITY;

-- Create RLS policies - users can manage components for products in their company
CREATE POLICY "Users can view components for their company products"
ON public.product_components
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.profiles pr ON pr.company_id = p.company_id
    WHERE p.id = parent_product_id
    AND pr.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert components for their company products"
ON public.product_components
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.profiles pr ON pr.company_id = p.company_id
    WHERE p.id = parent_product_id
    AND pr.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update components for their company products"
ON public.product_components
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.profiles pr ON pr.company_id = p.company_id
    WHERE p.id = parent_product_id
    AND pr.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete components for their company products"
ON public.product_components
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.profiles pr ON pr.company_id = p.company_id
    WHERE p.id = parent_product_id
    AND pr.user_id = auth.uid()
  )
);