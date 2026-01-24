-- Add UoM columns for dimensions to products table
ALTER TABLE public.products
ADD COLUMN width_uom text DEFAULT 'in',
ADD COLUMN length_uom text DEFAULT 'in',
ADD COLUMN height_uom text DEFAULT 'in',
ADD COLUMN weight_uom text DEFAULT 'lb';