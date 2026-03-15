ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS allow_modifications boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS restrict_modifications boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS restricted_products jsonb NOT NULL DEFAULT '[]'::jsonb;