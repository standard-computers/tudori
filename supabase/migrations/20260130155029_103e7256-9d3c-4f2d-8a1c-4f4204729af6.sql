-- Add is_consumable column to products table
-- When true, allows partial/fractional quantities for orders and inventory movements
ALTER TABLE public.products 
ADD COLUMN is_consumable boolean NOT NULL DEFAULT false;