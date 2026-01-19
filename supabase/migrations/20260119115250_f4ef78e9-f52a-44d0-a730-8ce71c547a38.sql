-- Create accounts table
CREATE TABLE public.accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  account_id VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'customer', -- customer, vendor
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, account_id)
);

-- Create invoices table
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  invoice_number VARCHAR(50) NOT NULL,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  sales_order_id UUID REFERENCES public.sales_orders(id) ON DELETE SET NULL,
  ledger_id UUID REFERENCES public.ledgers(id) ON DELETE SET NULL,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'draft', -- draft, pending, paid, cancelled
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, invoice_number),
  -- Ensure either PO or SO is referenced, but not both
  CONSTRAINT invoice_reference_check CHECK (
    (purchase_order_id IS NOT NULL AND sales_order_id IS NULL) OR
    (purchase_order_id IS NULL AND sales_order_id IS NOT NULL)
  )
);

-- Enable RLS on both tables
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- RLS policies for accounts
CREATE POLICY "Users can view accounts in their company"
ON public.accounts FOR SELECT
USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can create accounts in their company"
ON public.accounts FOR INSERT
WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can update accounts in their company"
ON public.accounts FOR UPDATE
USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can delete accounts in their company"
ON public.accounts FOR DELETE
USING (company_id = public.get_user_company_id(auth.uid()));

-- RLS policies for invoices
CREATE POLICY "Users can view invoices in their company"
ON public.invoices FOR SELECT
USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can create invoices in their company"
ON public.invoices FOR INSERT
WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can update invoices in their company"
ON public.invoices FOR UPDATE
USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can delete invoices in their company"
ON public.invoices FOR DELETE
USING (company_id = public.get_user_company_id(auth.uid()));

-- Create function to get next account ID
CREATE OR REPLACE FUNCTION public.get_next_account_id(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(account_id AS INTEGER)), 0) + 1
  INTO next_num
  FROM public.accounts
  WHERE company_id = p_company_id;
  
  RETURN LPAD(next_num::TEXT, 4, '0');
END;
$function$;

-- Create function to get next invoice number
CREATE OR REPLACE FUNCTION public.get_next_invoice_number(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 5) AS INTEGER)), 0) + 1
  INTO next_num
  FROM public.invoices
  WHERE company_id = p_company_id;
  
  RETURN 'INV-' || LPAD(next_num::TEXT, 4, '0');
END;
$function$;

-- Create indexes for performance
CREATE INDEX idx_accounts_company_id ON public.accounts(company_id);
CREATE INDEX idx_accounts_customer_id ON public.accounts(customer_id);
CREATE INDEX idx_accounts_vendor_id ON public.accounts(vendor_id);
CREATE INDEX idx_invoices_company_id ON public.invoices(company_id);
CREATE INDEX idx_invoices_account_id ON public.invoices(account_id);
CREATE INDEX idx_invoices_purchase_order_id ON public.invoices(purchase_order_id);
CREATE INDEX idx_invoices_sales_order_id ON public.invoices(sales_order_id);
CREATE INDEX idx_invoices_ledger_id ON public.invoices(ledger_id);