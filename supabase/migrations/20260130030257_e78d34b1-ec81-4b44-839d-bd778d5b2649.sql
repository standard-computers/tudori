-- Add status column to vendors table
ALTER TABLE public.vendors 
ADD COLUMN status TEXT NOT NULL DEFAULT 'active' 
CHECK (status IN ('active', 'blocked'));

-- Add comment for documentation
COMMENT ON COLUMN public.vendors.status IS 'Vendor status: active (can be used) or blocked (cannot be used in products, PRs, POs)';