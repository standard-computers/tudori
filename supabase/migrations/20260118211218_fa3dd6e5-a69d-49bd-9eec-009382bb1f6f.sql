-- Drop the trigger that updates balance
DROP TRIGGER IF EXISTS update_ledger_balance_trigger ON public.ledger_transactions;

-- Drop the function
DROP FUNCTION IF EXISTS public.update_ledger_balance();

-- Drop the balance column from ledgers
ALTER TABLE public.ledgers DROP COLUMN IF EXISTS balance;