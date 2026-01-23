-- Add batching-related columns to products table
ALTER TABLE public.products 
ADD COLUMN is_batched boolean NOT NULL DEFAULT false,
ADD COLUMN min_shelf_life_days integer;