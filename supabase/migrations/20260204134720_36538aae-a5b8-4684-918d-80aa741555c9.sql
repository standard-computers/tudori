-- Add payment_terms column to vendors table
ALTER TABLE public.vendors
ADD COLUMN payment_terms integer DEFAULT NULL;

-- Add payment_terms column to customers table
ALTER TABLE public.customers
ADD COLUMN payment_terms integer DEFAULT NULL;

-- Add payment_terms column to locations table
ALTER TABLE public.locations
ADD COLUMN payment_terms integer DEFAULT NULL;

-- Add comments for clarity
COMMENT ON COLUMN public.vendors.payment_terms IS 'Payment terms in days';
COMMENT ON COLUMN public.customers.payment_terms IS 'Payment terms in days';
COMMENT ON COLUMN public.locations.payment_terms IS 'Payment terms in days';