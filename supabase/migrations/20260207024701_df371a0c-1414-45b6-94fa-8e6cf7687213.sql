-- Add uom_id column to delivery_items for tracking unit of measure
ALTER TABLE public.delivery_items
ADD COLUMN uom_id uuid REFERENCES public.product_uoms(id) ON DELETE SET NULL;