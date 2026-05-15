ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS uom_id uuid REFERENCES public.product_uoms(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_uom_id ON public.inventory(uom_id);