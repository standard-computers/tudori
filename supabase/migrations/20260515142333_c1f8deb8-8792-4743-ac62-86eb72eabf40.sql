ALTER TABLE public.sales_order_items ADD COLUMN IF NOT EXISTS uom_id UUID REFERENCES public.product_uoms(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_sales_order_items_uom_id ON public.sales_order_items(uom_id);

ALTER TABLE public.outbound_delivery_items ADD COLUMN IF NOT EXISTS uom_id UUID REFERENCES public.product_uoms(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_outbound_delivery_items_uom_id ON public.outbound_delivery_items(uom_id);