-- Create deliveries table
CREATE TABLE public.deliveries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  delivery_id TEXT NOT NULL,
  purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  expected_date DATE,
  delivered_date DATE,
  tracking_number TEXT,
  carrier TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, delivery_id)
);

-- Enable RLS
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view deliveries in their company"
ON public.deliveries FOR SELECT
USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can create deliveries in their company"
ON public.deliveries FOR INSERT
WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can update deliveries in their company"
ON public.deliveries FOR UPDATE
USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can delete deliveries in their company"
ON public.deliveries FOR DELETE
USING (company_id = public.get_user_company_id(auth.uid()));

-- Function to get next delivery ID
CREATE OR REPLACE FUNCTION public.get_next_delivery_id(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(delivery_id FROM 5) AS INTEGER)), 0) + 1
  INTO next_num
  FROM public.deliveries
  WHERE company_id = p_company_id;
  
  RETURN 'DEL-' || LPAD(next_num::TEXT, 4, '0');
END;
$$;

-- Trigger for updated_at
CREATE TRIGGER update_deliveries_updated_at
BEFORE UPDATE ON public.deliveries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();