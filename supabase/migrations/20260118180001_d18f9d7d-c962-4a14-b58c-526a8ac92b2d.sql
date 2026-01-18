-- Create delivery_items table for tracking items in each delivery
CREATE TABLE public.delivery_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  delivery_id UUID NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.delivery_items ENABLE ROW LEVEL SECURITY;

-- Create policies for delivery_items
CREATE POLICY "Users can view delivery items for their company's deliveries"
ON public.delivery_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.deliveries d
    JOIN public.profiles p ON p.company_id = d.company_id
    WHERE d.id = delivery_items.delivery_id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert delivery items for their company's deliveries"
ON public.delivery_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.deliveries d
    JOIN public.profiles p ON p.company_id = d.company_id
    WHERE d.id = delivery_items.delivery_id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update delivery items for their company's deliveries"
ON public.delivery_items
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.deliveries d
    JOIN public.profiles p ON p.company_id = d.company_id
    WHERE d.id = delivery_items.delivery_id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete delivery items for their company's deliveries"
ON public.delivery_items
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.deliveries d
    JOIN public.profiles p ON p.company_id = d.company_id
    WHERE d.id = delivery_items.delivery_id
    AND p.user_id = auth.uid()
  )
);

-- Add index for faster queries
CREATE INDEX idx_delivery_items_delivery_id ON public.delivery_items(delivery_id);
CREATE INDEX idx_delivery_items_product_id ON public.delivery_items(product_id);