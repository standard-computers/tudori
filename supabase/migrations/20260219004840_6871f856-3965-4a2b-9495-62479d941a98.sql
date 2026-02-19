
ALTER TABLE public.product_components ADD COLUMN uom_id UUID REFERENCES public.product_uoms(id) ON DELETE SET NULL;
