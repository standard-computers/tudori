-- Add keep_inventory column to products table (enabled by default)
ALTER TABLE public.products 
ADD COLUMN keep_inventory boolean NOT NULL DEFAULT true;