-- Add hazardous column to products table
ALTER TABLE public.products 
ADD COLUMN hazardous boolean NOT NULL DEFAULT false;