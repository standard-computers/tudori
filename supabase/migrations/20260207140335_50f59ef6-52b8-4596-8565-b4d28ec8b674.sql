
-- Add goods receipt and goods issue controls to areas
ALTER TABLE public.areas ADD COLUMN is_goods_receipt_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.areas ADD COLUMN is_goods_issue_enabled boolean NOT NULL DEFAULT true;
