-- Create sales_orders table
CREATE TABLE public.sales_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  so_number VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  bill_to_location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  ledger_id UUID REFERENCES public.ledgers(id) ON DELETE SET NULL,
  tax_rate_id UUID REFERENCES public.tax_rates(id) ON DELETE SET NULL,
  subtotal NUMERIC(10,2) DEFAULT 0,
  tax_amount NUMERIC(10,2) DEFAULT 0,
  total_amount NUMERIC(10,2) DEFAULT 0,
  notes TEXT,
  order_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expected_delivery_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create sales_order_items table
CREATE TABLE public.sales_order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sales_order_id UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2),
  total_price NUMERIC(10,2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create sales_order_tax_rates junction table
CREATE TABLE public.sales_order_tax_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sales_order_id UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  tax_rate_id UUID NOT NULL REFERENCES public.tax_rates(id) ON DELETE CASCADE,
  tax_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(sales_order_id, tax_rate_id)
);

-- Create function to get next SO number
CREATE OR REPLACE FUNCTION public.get_next_so_number(p_company_id UUID)
RETURNS VARCHAR(50)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config document_id_config%ROWTYPE;
  v_next_number INTEGER;
  v_formatted_number VARCHAR(50);
BEGIN
  SELECT * INTO v_config 
  FROM document_id_config 
  WHERE company_id = p_company_id AND document_type = 'sales_order';
  
  IF NOT FOUND THEN
    INSERT INTO document_id_config (company_id, document_type, prefix, starting_number, num_digits)
    VALUES (p_company_id, 'sales_order', 'SO-', 1, 5)
    RETURNING * INTO v_config;
  END IF;
  
  SELECT COALESCE(MAX(
    CASE 
      WHEN so_number ~ ('^' || COALESCE(v_config.prefix, '') || '[0-9]+$')
      THEN CAST(SUBSTRING(so_number FROM LENGTH(COALESCE(v_config.prefix, '')) + 1) AS INTEGER)
      ELSE 0
    END
  ), v_config.starting_number - 1) + 1
  INTO v_next_number
  FROM sales_orders
  WHERE company_id = p_company_id;
  
  v_formatted_number := COALESCE(v_config.prefix, '') || LPAD(v_next_number::TEXT, v_config.num_digits, '0');
  
  RETURN v_formatted_number;
END;
$$;

-- Enable RLS
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_tax_rates ENABLE ROW LEVEL SECURITY;

-- RLS policies for sales_orders
CREATE POLICY "Users can view sales orders for their company"
ON public.sales_orders
FOR SELECT
USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can create sales orders for their company"
ON public.sales_orders
FOR INSERT
WITH CHECK (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update sales orders for their company"
ON public.sales_orders
FOR UPDATE
USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete sales orders for their company"
ON public.sales_orders
FOR DELETE
USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));

-- RLS policies for sales_order_items
CREATE POLICY "Users can view sales order items for their company"
ON public.sales_order_items
FOR SELECT
USING (sales_order_id IN (SELECT id FROM public.sales_orders WHERE company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())));

CREATE POLICY "Users can create sales order items for their company"
ON public.sales_order_items
FOR INSERT
WITH CHECK (sales_order_id IN (SELECT id FROM public.sales_orders WHERE company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())));

CREATE POLICY "Users can update sales order items for their company"
ON public.sales_order_items
FOR UPDATE
USING (sales_order_id IN (SELECT id FROM public.sales_orders WHERE company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())));

CREATE POLICY "Users can delete sales order items for their company"
ON public.sales_order_items
FOR DELETE
USING (sales_order_id IN (SELECT id FROM public.sales_orders WHERE company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())));

-- RLS policies for sales_order_tax_rates
CREATE POLICY "Users can view sales order tax rates for their company"
ON public.sales_order_tax_rates
FOR SELECT
USING (sales_order_id IN (SELECT id FROM public.sales_orders WHERE company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())));

CREATE POLICY "Users can create sales order tax rates for their company"
ON public.sales_order_tax_rates
FOR INSERT
WITH CHECK (sales_order_id IN (SELECT id FROM public.sales_orders WHERE company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())));

CREATE POLICY "Users can update sales order tax rates for their company"
ON public.sales_order_tax_rates
FOR UPDATE
USING (sales_order_id IN (SELECT id FROM public.sales_orders WHERE company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())));

CREATE POLICY "Users can delete sales order tax rates for their company"
ON public.sales_order_tax_rates
FOR DELETE
USING (sales_order_id IN (SELECT id FROM public.sales_orders WHERE company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())));