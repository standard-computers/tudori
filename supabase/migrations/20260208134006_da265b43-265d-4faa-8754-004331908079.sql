-- Add sequence columns to bins for controlling pick/put-away order
ALTER TABLE public.bins
ADD COLUMN picking_sequence integer DEFAULT NULL,
ADD COLUMN put_away_sequence integer DEFAULT NULL;