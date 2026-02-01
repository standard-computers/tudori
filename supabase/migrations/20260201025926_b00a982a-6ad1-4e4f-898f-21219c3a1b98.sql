-- Add lead time columns to products table
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS transport_time_days integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS manufacture_time_days integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS lead_time_days integer DEFAULT NULL;

COMMENT ON COLUMN public.products.transport_time_days IS 'Transport lead time in days';
COMMENT ON COLUMN public.products.manufacture_time_days IS 'Manufacturing lead time in days';
COMMENT ON COLUMN public.products.lead_time_days IS 'General lead time in days';