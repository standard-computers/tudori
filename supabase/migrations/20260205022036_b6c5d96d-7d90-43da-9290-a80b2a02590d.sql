-- Add hazardous control to bins
ALTER TABLE public.bins ADD COLUMN is_hazardous BOOLEAN NOT NULL DEFAULT false;

-- Add comment explaining the column
COMMENT ON COLUMN public.bins.is_hazardous IS 'When enabled, only products marked as hazardous may be placed in this bin';