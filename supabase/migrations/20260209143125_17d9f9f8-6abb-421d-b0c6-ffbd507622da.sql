-- Drop the old unique constraint that doesn't account for PU
ALTER TABLE public.inventory DROP CONSTRAINT inventory_location_id_bin_id_product_id_key;

-- Add new unique constraint that includes pu_id
-- Using a unique index with COALESCE to handle nulls properly
CREATE UNIQUE INDEX inventory_location_bin_product_pu_unique 
ON public.inventory (location_id, COALESCE(bin_id, '00000000-0000-0000-0000-000000000000'), product_id, COALESCE(pu_id, '00000000-0000-0000-0000-000000000000'));