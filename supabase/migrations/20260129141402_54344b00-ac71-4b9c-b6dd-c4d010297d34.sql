ALTER TABLE public.bins
ADD COLUMN is_production_enabled BOOLEAN NOT NULL DEFAULT false;