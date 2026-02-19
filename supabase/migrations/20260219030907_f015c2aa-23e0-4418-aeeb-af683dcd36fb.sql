
-- Create payments table
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_number TEXT NOT NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  account_id UUID NOT NULL REFERENCES public.accounts(id),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id),
  amount NUMERIC NOT NULL DEFAULT 0,
  payment_date TEXT NOT NULL DEFAULT (now()::date)::text,
  processed_by UUID,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- RLS policies scoped to company
CREATE POLICY "Users can view payments in their company"
ON public.payments FOR SELECT
USING (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can create payments in their company"
ON public.payments FOR INSERT
WITH CHECK (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update payments in their company"
ON public.payments FOR UPDATE
USING (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

-- Auto-generate payment numbers
CREATE OR REPLACE FUNCTION public.get_next_payment_number(p_company_id uuid)
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

  SELECT * INTO v_config
  FROM document_id_config
  WHERE company_id = p_company_id AND document_type = 'payment';

  IF NOT FOUND THEN
    INSERT INTO document_id_config (company_id, document_type, prefix, starting_number, num_digits)
    VALUES (p_company_id, 'payment', 'PAY-', 1, 4)
    RETURNING * INTO v_config;
  END IF;

  SELECT COALESCE(MAX(
    CASE
      WHEN payment_number ~ ('^' || COALESCE(v_config.prefix, '') || '[0-9]+$')
      THEN CAST(SUBSTRING(payment_number FROM LENGTH(COALESCE(v_config.prefix, '')) + 1) AS INTEGER)
      ELSE 0
    END
  ), v_config.starting_number - 1) + 1
  INTO v_next_number
  FROM payments
  WHERE company_id = p_company_id;

  v_formatted_number := COALESCE(v_config.prefix, '') || LPAD(v_next_number::TEXT, v_config.num_digits, '0');
  RETURN v_formatted_number;
END;
$$;
