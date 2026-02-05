-- Add parent_account_id column to accounts table for hierarchical account structure
ALTER TABLE public.accounts 
ADD COLUMN parent_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL;

-- Create index for faster parent account lookups
CREATE INDEX idx_accounts_parent_account_id ON public.accounts(parent_account_id);