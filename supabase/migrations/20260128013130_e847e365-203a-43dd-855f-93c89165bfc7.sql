-- Add is_production_enabled column to locations
ALTER TABLE public.locations 
ADD COLUMN is_production_enabled boolean NOT NULL DEFAULT false;

-- Create production_orders table
CREATE TABLE public.production_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  order_number text NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id),
  location_id uuid NOT NULL REFERENCES public.locations(id),
  quantity integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending',
  scheduled_date date,
  completed_date date,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create production_order_items table for tracking component consumption
CREATE TABLE public.production_order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  production_order_id uuid NOT NULL REFERENCES public.production_orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  required_quantity integer NOT NULL DEFAULT 0,
  consumed_quantity integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.production_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_order_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for production_orders
CREATE POLICY "Users can view production orders in their company"
ON public.production_orders FOR SELECT
USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can create production orders in their company"
ON public.production_orders FOR INSERT
WITH CHECK (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can update production orders in their company"
ON public.production_orders FOR UPDATE
USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can delete production orders in their company"
ON public.production_orders FOR DELETE
USING (company_id = get_user_company_id(auth.uid()));

-- RLS policies for production_order_items
CREATE POLICY "Users can view production order items in their company"
ON public.production_order_items FOR SELECT
USING (EXISTS (
  SELECT 1 FROM production_orders po
  WHERE po.id = production_order_items.production_order_id
  AND po.company_id = get_user_company_id(auth.uid())
));

CREATE POLICY "Users can create production order items in their company"
ON public.production_order_items FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM production_orders po
  WHERE po.id = production_order_items.production_order_id
  AND po.company_id = get_user_company_id(auth.uid())
));

CREATE POLICY "Users can update production order items in their company"
ON public.production_order_items FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM production_orders po
  WHERE po.id = production_order_items.production_order_id
  AND po.company_id = get_user_company_id(auth.uid())
));

CREATE POLICY "Users can delete production order items in their company"
ON public.production_order_items FOR DELETE
USING (EXISTS (
  SELECT 1 FROM production_orders po
  WHERE po.id = production_order_items.production_order_id
  AND po.company_id = get_user_company_id(auth.uid())
));

-- Create function to get next production order number
CREATE OR REPLACE FUNCTION public.get_next_production_order_number(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_config document_id_config%ROWTYPE;
  v_next_num INTEGER;
  v_formatted_number TEXT;
BEGIN
  IF get_user_company_id(auth.uid()) != p_company_id THEN
    RAISE EXCEPTION 'Access denied: User does not belong to this company';
  END IF;

  SELECT * INTO v_config
  FROM document_id_config
  WHERE company_id = p_company_id AND document_type = 'production_order';
  
  IF NOT FOUND THEN
    INSERT INTO document_id_config (company_id, document_type, prefix, starting_number, num_digits)
    VALUES (p_company_id, 'production_order', 'PRO-', 1, 4)
    RETURNING * INTO v_config;
  END IF;
  
  SELECT COALESCE(MAX(
    CASE 
      WHEN order_number ~ ('^' || COALESCE(v_config.prefix, '') || '[0-9]+$')
      THEN CAST(SUBSTRING(order_number FROM LENGTH(COALESCE(v_config.prefix, '')) + 1) AS INTEGER)
      ELSE 0
    END
  ), v_config.starting_number - 1) + 1
  INTO v_next_num
  FROM production_orders
  WHERE company_id = p_company_id;
  
  v_formatted_number := COALESCE(v_config.prefix, '') || LPAD(v_next_num::TEXT, v_config.num_digits, '0');
  
  RETURN v_formatted_number;
END;
$function$;