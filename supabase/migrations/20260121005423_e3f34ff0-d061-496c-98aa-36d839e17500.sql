-- Create outbound_deliveries table for shipments to customers
CREATE TABLE public.outbound_deliveries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  delivery_number TEXT NOT NULL,
  sales_order_id UUID REFERENCES public.sales_orders(id) ON DELETE SET NULL,
  goods_issue_id UUID REFERENCES public.goods_issues(id) ON DELETE SET NULL,
  from_location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  ship_to_address_line1 TEXT,
  ship_to_address_line2 TEXT,
  ship_to_city TEXT,
  ship_to_state TEXT,
  ship_to_postal_code TEXT,
  ship_to_country TEXT DEFAULT 'United States',
  status TEXT NOT NULL DEFAULT 'pending',
  shipped_date DATE,
  delivered_date DATE,
  tracking_number TEXT,
  carrier TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.outbound_deliveries ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view outbound_deliveries in their company"
ON public.outbound_deliveries FOR SELECT
USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can create outbound_deliveries in their company"
ON public.outbound_deliveries FOR INSERT
WITH CHECK (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can update outbound_deliveries in their company"
ON public.outbound_deliveries FOR UPDATE
USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can delete outbound_deliveries in their company"
ON public.outbound_deliveries FOR DELETE
USING (company_id = get_user_company_id(auth.uid()));

-- Add outbound_delivery_id to goods_issues table
ALTER TABLE public.goods_issues
ADD COLUMN outbound_delivery_id UUID REFERENCES public.outbound_deliveries(id) ON DELETE SET NULL;

-- Create function to generate next outbound delivery number
CREATE OR REPLACE FUNCTION public.get_next_outbound_delivery_number(p_company_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config document_id_config%ROWTYPE;
  v_current_max INTEGER;
  v_next_number INTEGER;
  v_formatted TEXT;
BEGIN
  -- Try to get config for 'outbound_delivery'
  SELECT * INTO v_config FROM document_id_config
  WHERE company_id = p_company_id AND document_type = 'outbound_delivery';

  IF NOT FOUND THEN
    -- Create default config
    INSERT INTO document_id_config (company_id, document_type, prefix, num_digits, starting_number)
    VALUES (p_company_id, 'outbound_delivery', 'OD', 4, 1)
    RETURNING * INTO v_config;
  END IF;

  -- Get current max number
  SELECT COALESCE(MAX(
    NULLIF(regexp_replace(delivery_number, '[^0-9]', '', 'g'), '')::INTEGER
  ), v_config.starting_number - 1)
  INTO v_current_max
  FROM outbound_deliveries
  WHERE company_id = p_company_id;

  v_next_number := v_current_max + 1;
  v_formatted := v_config.prefix || LPAD(v_next_number::TEXT, v_config.num_digits, '0');

  RETURN v_formatted;
END;
$$;

-- Create updated_at trigger
CREATE TRIGGER update_outbound_deliveries_updated_at
  BEFORE UPDATE ON public.outbound_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();