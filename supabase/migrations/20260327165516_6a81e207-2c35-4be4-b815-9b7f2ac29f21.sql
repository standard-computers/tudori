
ALTER TABLE public.tax_rates
  ADD COLUMN address_street text,
  ADD COLUMN address_city text,
  ADD COLUMN address_county text,
  ADD COLUMN address_state text,
  ADD COLUMN address_postal_code text,
  ADD COLUMN address_country text;
