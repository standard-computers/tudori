-- Add status column to locations table
ALTER TABLE public.locations 
ADD COLUMN status TEXT NOT NULL DEFAULT 'Active';

-- Add comment for documentation
COMMENT ON COLUMN public.locations.status IS 'Status of the location (Active, Inactive, etc.)';