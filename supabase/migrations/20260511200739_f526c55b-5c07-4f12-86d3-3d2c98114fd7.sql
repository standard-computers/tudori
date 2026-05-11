ALTER TABLE public.purchase_order_items
ADD COLUMN IF NOT EXISTS uom_id UUID REFERENCES public.product_uoms(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_purchase_order_items_uom_id ON public.purchase_order_items(uom_id);