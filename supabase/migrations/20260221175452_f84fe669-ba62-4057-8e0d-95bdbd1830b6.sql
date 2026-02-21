
-- Add notes column to ledgers table
ALTER TABLE public.ledgers ADD COLUMN IF NOT EXISTS notes text;

-- Add valid_from and valid_to columns to accounts table
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS valid_from date;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS valid_to date;
