-- Add account_manager_id column to accounts table
ALTER TABLE public.accounts 
ADD COLUMN account_manager_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX idx_accounts_account_manager_id ON public.accounts(account_manager_id);