-- Add pu_id column to sales_order_items for UOM tracking
ALTER TABLE public.sales_order_items
ADD COLUMN pu_id uuid REFERENCES public.packaging_units(id);