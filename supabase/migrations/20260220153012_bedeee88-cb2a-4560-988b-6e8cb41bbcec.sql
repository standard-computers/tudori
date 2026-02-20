
-- Add notes column to accounts table
ALTER TABLE public.accounts ADD COLUMN notes text;

-- Migrate existing description data to notes
UPDATE public.accounts SET notes = description WHERE description IS NOT NULL;

-- Drop description column
ALTER TABLE public.accounts DROP COLUMN description;
