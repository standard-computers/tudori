-- Add control columns to bins table
ALTER TABLE public.bins
ADD COLUMN allow_put_away boolean NOT NULL DEFAULT true,
ADD COLUMN allow_auto_put_away boolean NOT NULL DEFAULT true,
ADD COLUMN allow_picking boolean NOT NULL DEFAULT true,
ADD COLUMN allow_auto_picking boolean NOT NULL DEFAULT true;