-- Create ledgers table
CREATE TABLE public.ledgers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  ledger_id TEXT NOT NULL,
  name TEXT NOT NULL,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  balance NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, ledger_id)
);

-- Create ledger_transactions table
CREATE TABLE public.ledger_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ledger_id UUID NOT NULL REFERENCES public.ledgers(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL, -- 'purchase_order', 'invoice', 'sales_order', etc.
  reference_id UUID, -- The PO id, invoice id, etc.
  reference_number TEXT, -- PO number, invoice number, etc.
  amount NUMERIC NOT NULL, -- Negative for purchases, positive for income
  description TEXT,
  transaction_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add bill_to_location_id to purchase_orders
ALTER TABLE public.purchase_orders 
ADD COLUMN bill_to_location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL;

-- Add ledger_id to purchase_orders
ALTER TABLE public.purchase_orders 
ADD COLUMN ledger_id UUID REFERENCES public.ledgers(id) ON DELETE SET NULL;

-- Enable RLS on ledgers
ALTER TABLE public.ledgers ENABLE ROW LEVEL SECURITY;

-- Ledgers RLS policies
CREATE POLICY "Users can view ledgers in their company"
ON public.ledgers FOR SELECT
USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Admins can create ledgers"
ON public.ledgers FOR INSERT
WITH CHECK (
  company_id = public.get_user_company_id(auth.uid())
  AND public.is_company_admin(auth.uid(), company_id)
);

CREATE POLICY "Admins can update ledgers"
ON public.ledgers FOR UPDATE
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND public.is_company_admin(auth.uid(), company_id)
);

CREATE POLICY "Admins can delete ledgers"
ON public.ledgers FOR DELETE
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND public.is_company_admin(auth.uid(), company_id)
);

-- Enable RLS on ledger_transactions
ALTER TABLE public.ledger_transactions ENABLE ROW LEVEL SECURITY;

-- Ledger transactions RLS policies (via ledger company)
CREATE POLICY "Users can view transactions in their company ledgers"
ON public.ledger_transactions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.ledgers
    WHERE ledgers.id = ledger_transactions.ledger_id
    AND ledgers.company_id = public.get_user_company_id(auth.uid())
  )
);

CREATE POLICY "Users can create transactions in their company ledgers"
ON public.ledger_transactions FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.ledgers
    WHERE ledgers.id = ledger_transactions.ledger_id
    AND ledgers.company_id = public.get_user_company_id(auth.uid())
  )
);

-- Function to get next ledger ID
CREATE OR REPLACE FUNCTION public.get_next_ledger_id(p_company_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(ledger_id AS INTEGER)), 0) + 1
  INTO next_num
  FROM public.ledgers
  WHERE company_id = p_company_id;
  
  RETURN LPAD(next_num::TEXT, 4, '0');
END;
$$;

-- Trigger to update ledger balance when transaction is added
CREATE OR REPLACE FUNCTION public.update_ledger_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.ledgers 
    SET balance = balance + NEW.amount,
        updated_at = now()
    WHERE id = NEW.ledger_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.ledgers 
    SET balance = balance - OLD.amount,
        updated_at = now()
    WHERE id = OLD.ledger_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER update_ledger_balance_trigger
AFTER INSERT OR DELETE ON public.ledger_transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_ledger_balance();

-- Update document_id_config to include ledger type
INSERT INTO public.document_id_config (company_id, document_type, prefix, num_digits, starting_number)
SELECT DISTINCT company_id, 'ledger', '', 4, 1
FROM public.document_id_config
ON CONFLICT DO NOTHING;