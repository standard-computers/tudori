-- Create credit_memos table
CREATE TABLE public.credit_memos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  memo_number TEXT NOT NULL,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  ledger_id UUID REFERENCES public.ledgers(id) ON DELETE SET NULL,
  memo_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create debit_memos table
CREATE TABLE public.debit_memos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  memo_number TEXT NOT NULL,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  ledger_id UUID REFERENCES public.ledgers(id) ON DELETE SET NULL,
  memo_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.credit_memos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debit_memos ENABLE ROW LEVEL SECURITY;

-- RLS policies for credit_memos
CREATE POLICY "Users can view credit memos in their company"
ON public.credit_memos FOR SELECT
USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can create credit memos in their company"
ON public.credit_memos FOR INSERT
WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can update credit memos in their company"
ON public.credit_memos FOR UPDATE
USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can delete credit memos in their company"
ON public.credit_memos FOR DELETE
USING (company_id = public.get_user_company_id(auth.uid()));

-- RLS policies for debit_memos
CREATE POLICY "Users can view debit memos in their company"
ON public.debit_memos FOR SELECT
USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can create debit memos in their company"
ON public.debit_memos FOR INSERT
WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can update debit memos in their company"
ON public.debit_memos FOR UPDATE
USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can delete debit memos in their company"
ON public.debit_memos FOR DELETE
USING (company_id = public.get_user_company_id(auth.uid()));

-- Function to get next credit memo number
CREATE OR REPLACE FUNCTION public.get_next_credit_memo_number(p_company_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(memo_number FROM 4) AS INTEGER)), 0) + 1
  INTO next_num
  FROM public.credit_memos
  WHERE company_id = p_company_id;
  
  RETURN 'CM-' || LPAD(next_num::TEXT, 4, '0');
END;
$$;

-- Function to get next debit memo number
CREATE OR REPLACE FUNCTION public.get_next_debit_memo_number(p_company_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(memo_number FROM 4) AS INTEGER)), 0) + 1
  INTO next_num
  FROM public.debit_memos
  WHERE company_id = p_company_id;
  
  RETURN 'DM-' || LPAD(next_num::TEXT, 4, '0');
END;
$$;

-- Update triggers
CREATE TRIGGER update_credit_memos_updated_at
BEFORE UPDATE ON public.credit_memos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_debit_memos_updated_at
BEFORE UPDATE ON public.debit_memos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();