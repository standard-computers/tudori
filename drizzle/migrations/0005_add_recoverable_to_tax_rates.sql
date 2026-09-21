ALTER TABLE public.tax_rates ADD COLUMN recoverable boolean DEFAULT false;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tax_rates TO authenticated;
GRANT ALL ON public.tax_rates TO service_role;
COMMENT ON COLUMN public.tax_rates.recoverable IS 'Whether amounts charged with this rate are recoverable';