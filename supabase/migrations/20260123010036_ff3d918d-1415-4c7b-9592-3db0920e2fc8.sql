-- Add dimension fields to products table
ALTER TABLE public.products 
ADD COLUMN width numeric,
ADD COLUMN length numeric,
ADD COLUMN height numeric,
ADD COLUMN weight numeric;

COMMENT ON COLUMN public.products.width IS 'Width dimension';
COMMENT ON COLUMN public.products.length IS 'Length dimension';
COMMENT ON COLUMN public.products.height IS 'Height dimension';
COMMENT ON COLUMN public.products.weight IS 'Weight';