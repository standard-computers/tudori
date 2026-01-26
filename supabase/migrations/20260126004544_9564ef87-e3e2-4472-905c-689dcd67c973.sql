-- Add is_pos_enabled column to locations table
ALTER TABLE public.locations 
ADD COLUMN is_pos_enabled boolean NOT NULL DEFAULT false;