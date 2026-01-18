-- Create tax_rates table
CREATE TABLE public.tax_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tax_rates ENABLE ROW LEVEL SECURITY;

-- RLS policies for tax_rates
CREATE POLICY "Users can view tax rates from their company"
ON public.tax_rates
FOR SELECT
USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Admins can insert tax rates for their company"
ON public.tax_rates
FOR INSERT
WITH CHECK (
  company_id = public.get_user_company_id(auth.uid())
  AND public.is_company_admin(auth.uid(), company_id)
);

CREATE POLICY "Admins can update tax rates for their company"
ON public.tax_rates
FOR UPDATE
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND public.is_company_admin(auth.uid(), company_id)
);

CREATE POLICY "Admins can delete tax rates for their company"
ON public.tax_rates
FOR DELETE
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND public.is_company_admin(auth.uid(), company_id)
);

-- Add tax_rate_id to purchase_orders
ALTER TABLE public.purchase_orders ADD COLUMN tax_rate_id UUID REFERENCES public.tax_rates(id) ON DELETE SET NULL;