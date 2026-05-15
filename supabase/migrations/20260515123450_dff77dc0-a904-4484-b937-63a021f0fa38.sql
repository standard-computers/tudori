ALTER TABLE public.goods_receipt_items ADD COLUMN IF NOT EXISTS uom_id uuid REFERENCES public.product_uoms(id) ON DELETE SET NULL;
ALTER TABLE public.goods_issue_items ADD COLUMN IF NOT EXISTS uom_id uuid REFERENCES public.product_uoms(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_goods_receipt_items_uom_id ON public.goods_receipt_items(uom_id);
CREATE INDEX IF NOT EXISTS idx_goods_issue_items_uom_id ON public.goods_issue_items(uom_id);