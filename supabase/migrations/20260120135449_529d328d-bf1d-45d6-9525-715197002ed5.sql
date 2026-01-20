-- Create goods_receipts table for tracking inventory coming INTO locations
CREATE TABLE public.goods_receipts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  receipt_number TEXT NOT NULL,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  delivery_id UUID REFERENCES public.deliveries(id) ON DELETE SET NULL,
  purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create goods_receipt_items table
CREATE TABLE public.goods_receipt_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  goods_receipt_id UUID NOT NULL REFERENCES public.goods_receipts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0,
  bin_id UUID REFERENCES public.bins(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create goods_issues table for tracking inventory going OUT of locations
CREATE TABLE public.goods_issues (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  issue_number TEXT NOT NULL,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  sales_order_id UUID REFERENCES public.sales_orders(id) ON DELETE SET NULL,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create goods_issue_items table
CREATE TABLE public.goods_issue_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  goods_issue_id UUID NOT NULL REFERENCES public.goods_issues(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0,
  bin_id UUID REFERENCES public.bins(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.goods_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_issue_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for goods_receipts
CREATE POLICY "Users can view goods_receipts in their company"
  ON public.goods_receipts FOR SELECT
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can create goods_receipts in their company"
  ON public.goods_receipts FOR INSERT
  WITH CHECK (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can update goods_receipts in their company"
  ON public.goods_receipts FOR UPDATE
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can delete goods_receipts in their company"
  ON public.goods_receipts FOR DELETE
  USING (company_id = get_user_company_id(auth.uid()));

-- RLS policies for goods_receipt_items
CREATE POLICY "Users can view goods_receipt_items in their company"
  ON public.goods_receipt_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.goods_receipts gr
    WHERE gr.id = goods_receipt_id AND gr.company_id = get_user_company_id(auth.uid())
  ));

CREATE POLICY "Users can create goods_receipt_items in their company"
  ON public.goods_receipt_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.goods_receipts gr
    WHERE gr.id = goods_receipt_id AND gr.company_id = get_user_company_id(auth.uid())
  ));

CREATE POLICY "Users can update goods_receipt_items in their company"
  ON public.goods_receipt_items FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.goods_receipts gr
    WHERE gr.id = goods_receipt_id AND gr.company_id = get_user_company_id(auth.uid())
  ));

CREATE POLICY "Users can delete goods_receipt_items in their company"
  ON public.goods_receipt_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.goods_receipts gr
    WHERE gr.id = goods_receipt_id AND gr.company_id = get_user_company_id(auth.uid())
  ));

-- RLS policies for goods_issues
CREATE POLICY "Users can view goods_issues in their company"
  ON public.goods_issues FOR SELECT
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can create goods_issues in their company"
  ON public.goods_issues FOR INSERT
  WITH CHECK (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can update goods_issues in their company"
  ON public.goods_issues FOR UPDATE
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can delete goods_issues in their company"
  ON public.goods_issues FOR DELETE
  USING (company_id = get_user_company_id(auth.uid()));

-- RLS policies for goods_issue_items
CREATE POLICY "Users can view goods_issue_items in their company"
  ON public.goods_issue_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.goods_issues gi
    WHERE gi.id = goods_issue_id AND gi.company_id = get_user_company_id(auth.uid())
  ));

CREATE POLICY "Users can create goods_issue_items in their company"
  ON public.goods_issue_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.goods_issues gi
    WHERE gi.id = goods_issue_id AND gi.company_id = get_user_company_id(auth.uid())
  ));

CREATE POLICY "Users can update goods_issue_items in their company"
  ON public.goods_issue_items FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.goods_issues gi
    WHERE gi.id = goods_issue_id AND gi.company_id = get_user_company_id(auth.uid())
  ));

CREATE POLICY "Users can delete goods_issue_items in their company"
  ON public.goods_issue_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.goods_issues gi
    WHERE gi.id = goods_issue_id AND gi.company_id = get_user_company_id(auth.uid())
  ));

-- Create function to get next goods receipt number
CREATE OR REPLACE FUNCTION public.get_next_goods_receipt_number(p_company_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix TEXT := 'GR-';
  v_num_digits INTEGER := 4;
  v_next_num INTEGER;
  v_config RECORD;
BEGIN
  -- Verify user belongs to this company
  IF get_user_company_id(auth.uid()) != p_company_id THEN
    RAISE EXCEPTION 'Access denied: User does not belong to this company';
  END IF;

  SELECT prefix, num_digits INTO v_config
  FROM document_id_config
  WHERE company_id = p_company_id AND document_type = 'goods_receipt';
  
  IF FOUND THEN
    v_prefix := COALESCE(v_config.prefix, v_prefix);
    v_num_digits := COALESCE(v_config.num_digits, v_num_digits);
  END IF;
  
  SELECT COALESCE(MAX(
    CASE 
      WHEN receipt_number ~ ('^' || v_prefix || '[0-9]+$')
      THEN CAST(SUBSTRING(receipt_number FROM LENGTH(v_prefix) + 1) AS INTEGER)
      ELSE 0
    END
  ), 0) + 1
  INTO v_next_num
  FROM goods_receipts
  WHERE company_id = p_company_id;
  
  RETURN v_prefix || LPAD(v_next_num::TEXT, v_num_digits, '0');
END;
$$;

-- Create function to get next goods issue number
CREATE OR REPLACE FUNCTION public.get_next_goods_issue_number(p_company_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix TEXT := 'GI-';
  v_num_digits INTEGER := 4;
  v_next_num INTEGER;
  v_config RECORD;
BEGIN
  -- Verify user belongs to this company
  IF get_user_company_id(auth.uid()) != p_company_id THEN
    RAISE EXCEPTION 'Access denied: User does not belong to this company';
  END IF;

  SELECT prefix, num_digits INTO v_config
  FROM document_id_config
  WHERE company_id = p_company_id AND document_type = 'goods_issue';
  
  IF FOUND THEN
    v_prefix := COALESCE(v_config.prefix, v_prefix);
    v_num_digits := COALESCE(v_config.num_digits, v_num_digits);
  END IF;
  
  SELECT COALESCE(MAX(
    CASE 
      WHEN issue_number ~ ('^' || v_prefix || '[0-9]+$')
      THEN CAST(SUBSTRING(issue_number FROM LENGTH(v_prefix) + 1) AS INTEGER)
      ELSE 0
    END
  ), 0) + 1
  INTO v_next_num
  FROM goods_issues
  WHERE company_id = p_company_id;
  
  RETURN v_prefix || LPAD(v_next_num::TEXT, v_num_digits, '0');
END;
$$;

-- Create trigger for updated_at on goods_receipts
CREATE TRIGGER update_goods_receipts_updated_at
  BEFORE UPDATE ON public.goods_receipts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for updated_at on goods_issues
CREATE TRIGGER update_goods_issues_updated_at
  BEFORE UPDATE ON public.goods_issues
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();