
-- Create inventory_counts table (count sessions/headers)
CREATE TABLE public.inventory_counts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  count_number TEXT NOT NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  location_id UUID NOT NULL REFERENCES public.locations(id),
  status TEXT NOT NULL DEFAULT 'draft',
  count_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create inventory_count_items table (individual count lines)
CREATE TABLE public.inventory_count_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  count_id UUID NOT NULL REFERENCES public.inventory_counts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  bin_id UUID REFERENCES public.bins(id),
  system_quantity NUMERIC NOT NULL DEFAULT 0,
  counted_quantity NUMERIC,
  variance NUMERIC GENERATED ALWAYS AS (COALESCE(counted_quantity, 0) - system_quantity) STORED,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.inventory_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_count_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for inventory_counts
CREATE POLICY "Users can view inventory counts for their company"
  ON public.inventory_counts FOR SELECT
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can create inventory counts for their company"
  ON public.inventory_counts FOR INSERT
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can update inventory counts for their company"
  ON public.inventory_counts FOR UPDATE
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can delete inventory counts for their company"
  ON public.inventory_counts FOR DELETE
  USING (company_id = public.get_user_company_id(auth.uid()));

-- RLS policies for inventory_count_items (via join to parent)
CREATE POLICY "Users can view count items for their company"
  ON public.inventory_count_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.inventory_counts ic
    WHERE ic.id = count_id AND ic.company_id = public.get_user_company_id(auth.uid())
  ));

CREATE POLICY "Users can create count items for their company"
  ON public.inventory_count_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.inventory_counts ic
    WHERE ic.id = count_id AND ic.company_id = public.get_user_company_id(auth.uid())
  ));

CREATE POLICY "Users can update count items for their company"
  ON public.inventory_count_items FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.inventory_counts ic
    WHERE ic.id = count_id AND ic.company_id = public.get_user_company_id(auth.uid())
  ));

CREATE POLICY "Users can delete count items for their company"
  ON public.inventory_count_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.inventory_counts ic
    WHERE ic.id = count_id AND ic.company_id = public.get_user_company_id(auth.uid())
  ));

-- Trigger for updated_at
CREATE TRIGGER update_inventory_counts_updated_at
  BEFORE UPDATE ON public.inventory_counts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to generate next count number
CREATE OR REPLACE FUNCTION public.get_next_count_number(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  WHERE company_id = p_company_id AND document_type = 'inventory_count';
  
  IF NOT FOUND THEN
    INSERT INTO document_id_config (company_id, document_type, prefix, starting_number, num_digits)
    VALUES (p_company_id, 'inventory_count', 'IC-', 1, 4)
    RETURNING * INTO v_config;
  END IF;
  
  SELECT COALESCE(MAX(
    CASE 
      WHEN count_number ~ ('^' || COALESCE(v_config.prefix, '') || '[0-9]+$')
      THEN CAST(SUBSTRING(count_number FROM LENGTH(COALESCE(v_config.prefix, '')) + 1) AS INTEGER)
      ELSE 0
    END
  ), v_config.starting_number - 1) + 1
  INTO v_next_num
  FROM inventory_counts
  WHERE company_id = p_company_id;
  
  v_formatted_number := COALESCE(v_config.prefix, '') || LPAD(v_next_num::TEXT, v_config.num_digits, '0');
  
  RETURN v_formatted_number;
END;
$$;
