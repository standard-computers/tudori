
-- Create agreements table
CREATE TABLE public.agreements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agreement_id TEXT NOT NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create agreement_accounts junction table
CREATE TABLE public.agreement_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agreement_id UUID NOT NULL REFERENCES public.agreements(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(agreement_id, account_id)
);

-- Create agreement_items table
CREATE TABLE public.agreement_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agreement_id UUID NOT NULL REFERENCES public.agreements(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agreement_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agreement_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for agreements
CREATE POLICY "Company members can view agreements" ON public.agreements
  FOR SELECT USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "Company members can insert agreements" ON public.agreements
  FOR INSERT WITH CHECK (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "Company members can update agreements" ON public.agreements
  FOR UPDATE USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "Company members can delete agreements" ON public.agreements
  FOR DELETE USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));

-- RLS Policies for agreement_accounts
CREATE POLICY "Company members can view agreement_accounts" ON public.agreement_accounts
  FOR SELECT USING (agreement_id IN (SELECT id FROM public.agreements WHERE company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())));
CREATE POLICY "Company members can insert agreement_accounts" ON public.agreement_accounts
  FOR INSERT WITH CHECK (agreement_id IN (SELECT id FROM public.agreements WHERE company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())));
CREATE POLICY "Company members can delete agreement_accounts" ON public.agreement_accounts
  FOR DELETE USING (agreement_id IN (SELECT id FROM public.agreements WHERE company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())));

-- RLS Policies for agreement_items
CREATE POLICY "Company members can view agreement_items" ON public.agreement_items
  FOR SELECT USING (agreement_id IN (SELECT id FROM public.agreements WHERE company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())));
CREATE POLICY "Company members can insert agreement_items" ON public.agreement_items
  FOR INSERT WITH CHECK (agreement_id IN (SELECT id FROM public.agreements WHERE company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())));
CREATE POLICY "Company members can update agreement_items" ON public.agreement_items
  FOR UPDATE USING (agreement_id IN (SELECT id FROM public.agreements WHERE company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())));
CREATE POLICY "Company members can delete agreement_items" ON public.agreement_items
  FOR DELETE USING (agreement_id IN (SELECT id FROM public.agreements WHERE company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())));

-- Timestamp trigger
CREATE OR REPLACE FUNCTION public.update_agreements_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_agreements_updated_at
  BEFORE UPDATE ON public.agreements
  FOR EACH ROW EXECUTE FUNCTION public.update_agreements_updated_at();

-- Next agreement ID function
CREATE OR REPLACE FUNCTION public.get_next_agreement_id(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_config document_id_config%ROWTYPE;
  v_next_number INTEGER;
  v_formatted_number TEXT;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid() AND company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  SELECT * INTO v_config FROM document_id_config WHERE company_id = p_company_id AND document_type = 'agreement';
  IF NOT FOUND THEN
    INSERT INTO document_id_config (company_id, document_type, prefix, starting_number, num_digits)
    VALUES (p_company_id, 'agreement', 'AGR-', 1, 4)
    RETURNING * INTO v_config;
  END IF;
  SELECT COALESCE(MAX(
    CASE
      WHEN agreement_id ~ ('^' || COALESCE(v_config.prefix, '') || '[0-9]+$')
      THEN CAST(SUBSTRING(agreement_id FROM LENGTH(COALESCE(v_config.prefix, '')) + 1) AS INTEGER)
      ELSE 0
    END
  ), v_config.starting_number - 1) + 1
  INTO v_next_number
  FROM agreements WHERE company_id = p_company_id;
  v_formatted_number := COALESCE(v_config.prefix, '') || LPAD(v_next_number::TEXT, v_config.num_digits, '0');
  RETURN v_formatted_number;
END;
$$;
