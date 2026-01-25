-- Add location_id column to accounts table
ALTER TABLE public.accounts ADD COLUMN location_id uuid REFERENCES public.locations(id);

-- Add index for performance
CREATE INDEX idx_accounts_location_id ON public.accounts(location_id);