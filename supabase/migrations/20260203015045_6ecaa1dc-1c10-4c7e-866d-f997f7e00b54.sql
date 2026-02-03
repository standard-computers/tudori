-- Create invoice_items table for line items
CREATE TABLE public.invoice_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity NUMERIC(12,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2),
  total_price NUMERIC(12,2),
  pu_id UUID REFERENCES public.packaging_units(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create invoice_tax_rates table for multiple tax rates
CREATE TABLE public.invoice_tax_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  tax_rate_id UUID NOT NULL REFERENCES public.tax_rates(id) ON DELETE CASCADE,
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(invoice_id, tax_rate_id)
);

-- Add subtotal and tax_amount columns to invoices
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12,2) DEFAULT 0;

-- Enable RLS
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_tax_rates ENABLE ROW LEVEL SECURITY;

-- RLS policies for invoice_items (via invoice -> company)
CREATE POLICY "Users can view invoice items for their company"
ON public.invoice_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.invoices inv
    JOIN public.profiles p ON p.company_id = inv.company_id
    WHERE inv.id = invoice_items.invoice_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert invoice items for their company"
ON public.invoice_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.invoices inv
    JOIN public.profiles p ON p.company_id = inv.company_id
    WHERE inv.id = invoice_items.invoice_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update invoice items for their company"
ON public.invoice_items
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.invoices inv
    JOIN public.profiles p ON p.company_id = inv.company_id
    WHERE inv.id = invoice_items.invoice_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete invoice items for their company"
ON public.invoice_items
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.invoices inv
    JOIN public.profiles p ON p.company_id = inv.company_id
    WHERE inv.id = invoice_items.invoice_id AND p.user_id = auth.uid()
  )
);

-- RLS policies for invoice_tax_rates
CREATE POLICY "Users can view invoice tax rates for their company"
ON public.invoice_tax_rates
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.invoices inv
    JOIN public.profiles p ON p.company_id = inv.company_id
    WHERE inv.id = invoice_tax_rates.invoice_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert invoice tax rates for their company"
ON public.invoice_tax_rates
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.invoices inv
    JOIN public.profiles p ON p.company_id = inv.company_id
    WHERE inv.id = invoice_tax_rates.invoice_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update invoice tax rates for their company"
ON public.invoice_tax_rates
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.invoices inv
    JOIN public.profiles p ON p.company_id = inv.company_id
    WHERE inv.id = invoice_tax_rates.invoice_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete invoice tax rates for their company"
ON public.invoice_tax_rates
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.invoices inv
    JOIN public.profiles p ON p.company_id = inv.company_id
    WHERE inv.id = invoice_tax_rates.invoice_id AND p.user_id = auth.uid()
  )
);