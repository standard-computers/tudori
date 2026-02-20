
-- Add ledger_id to accounts so Inventory accounts can reference their ledger
ALTER TABLE public.accounts ADD COLUMN ledger_id UUID REFERENCES public.ledgers(id);

-- Create index for efficient lookup of inventory accounts by location
CREATE INDEX idx_accounts_inventory_location ON public.accounts (location_id, type) WHERE type = 'inventory';
