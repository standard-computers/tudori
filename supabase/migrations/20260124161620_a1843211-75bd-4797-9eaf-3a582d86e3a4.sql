-- Add is_internal_vendor column to locations table
-- This flag determines if a location can appear as a vendor source in requisitions
ALTER TABLE public.locations 
ADD COLUMN is_internal_vendor boolean NOT NULL DEFAULT true;