-- Add pu_id column to purchase_order_items for UOM tracking
ALTER TABLE public.purchase_order_items 
ADD COLUMN pu_id uuid REFERENCES public.packaging_units(id);

-- Add comment explaining the column
COMMENT ON COLUMN public.purchase_order_items.pu_id IS 'Optional packaging unit ID for UOM selection. If null, uses the product base unit.';