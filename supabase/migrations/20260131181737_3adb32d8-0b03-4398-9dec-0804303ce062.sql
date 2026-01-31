-- Add rate_type column to tax_rates table to support both percentage and flat fee rates
ALTER TABLE public.tax_rates 
ADD COLUMN IF NOT EXISTS rate_type TEXT NOT NULL DEFAULT 'percent' CHECK (rate_type IN ('percent', 'flat'));