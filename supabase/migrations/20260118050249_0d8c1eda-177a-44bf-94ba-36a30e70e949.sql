-- Create purchase_order_tax_rates junction table for multiple tax rates per PO
CREATE TABLE public.purchase_order_tax_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  tax_rate_id UUID NOT NULL REFERENCES public.tax_rates(id) ON DELETE CASCADE,
  tax_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(purchase_order_id, tax_rate_id)
);

-- Enable RLS
ALTER TABLE public.purchase_order_tax_rates ENABLE ROW LEVEL SECURITY;

-- Create RLS policies - users can manage tax rates for POs in their company
CREATE POLICY "Users can view tax rates for their company POs"
ON public.purchase_order_tax_rates
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.purchase_orders po
    JOIN public.profiles p ON p.company_id = po.company_id
    WHERE po.id = purchase_order_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert tax rates for their company POs"
ON public.purchase_order_tax_rates
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.purchase_orders po
    JOIN public.profiles p ON p.company_id = po.company_id
    WHERE po.id = purchase_order_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update tax rates for their company POs"
ON public.purchase_order_tax_rates
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.purchase_orders po
    JOIN public.profiles p ON p.company_id = po.company_id
    WHERE po.id = purchase_order_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete tax rates for their company POs"
ON public.purchase_order_tax_rates
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.purchase_orders po
    JOIN public.profiles p ON p.company_id = po.company_id
    WHERE po.id = purchase_order_id AND p.user_id = auth.uid()
  )
);
