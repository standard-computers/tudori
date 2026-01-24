-- Add status column to products table with default 'active'
ALTER TABLE public.products 
ADD COLUMN status TEXT NOT NULL DEFAULT 'active' 
CHECK (status IN ('active', 'do_not_buy', 'discontinued'));