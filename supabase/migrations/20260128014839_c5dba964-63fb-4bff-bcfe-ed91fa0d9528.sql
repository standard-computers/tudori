-- Create Bill of Materials table
CREATE TABLE public.bill_of_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  bom_id TEXT NOT NULL,
  name TEXT NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  output_quantity INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, bom_id)
);

-- Create BoM items table
CREATE TABLE public.bom_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bom_id UUID NOT NULL REFERENCES public.bill_of_materials(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity NUMERIC NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bill_of_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bom_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for bill_of_materials
CREATE POLICY "Users can view BOMs in their company"
  ON public.bill_of_materials FOR SELECT
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can create BOMs in their company"
  ON public.bill_of_materials FOR INSERT
  WITH CHECK (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can update BOMs in their company"
  ON public.bill_of_materials FOR UPDATE
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can delete BOMs in their company"
  ON public.bill_of_materials FOR DELETE
  USING (company_id = get_user_company_id(auth.uid()));

-- RLS policies for bom_items
CREATE POLICY "Users can view BOM items in their company"
  ON public.bom_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM bill_of_materials bom
    WHERE bom.id = bom_items.bom_id
    AND bom.company_id = get_user_company_id(auth.uid())
  ));

CREATE POLICY "Users can create BOM items in their company"
  ON public.bom_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM bill_of_materials bom
    WHERE bom.id = bom_items.bom_id
    AND bom.company_id = get_user_company_id(auth.uid())
  ));

CREATE POLICY "Users can update BOM items in their company"
  ON public.bom_items FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM bill_of_materials bom
    WHERE bom.id = bom_items.bom_id
    AND bom.company_id = get_user_company_id(auth.uid())
  ));

CREATE POLICY "Users can delete BOM items in their company"
  ON public.bom_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM bill_of_materials bom
    WHERE bom.id = bom_items.bom_id
    AND bom.company_id = get_user_company_id(auth.uid())
  ));

-- Add bom_id to production_orders
ALTER TABLE public.production_orders ADD COLUMN bom_id UUID REFERENCES public.bill_of_materials(id) ON DELETE RESTRICT;

-- Create function to get next BoM ID
CREATE OR REPLACE FUNCTION public.get_next_bom_id(p_company_id uuid)
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
  WHERE company_id = p_company_id AND document_type = 'bill_of_materials';
  
  IF NOT FOUND THEN
    INSERT INTO document_id_config (company_id, document_type, prefix, starting_number, num_digits)
    VALUES (p_company_id, 'bill_of_materials', 'BOM-', 1, 4)
    RETURNING * INTO v_config;
  END IF;
  
  SELECT COALESCE(MAX(
    CASE 
      WHEN bom_id ~ ('^' || COALESCE(v_config.prefix, '') || '[0-9]+$')
      THEN CAST(SUBSTRING(bom_id FROM LENGTH(COALESCE(v_config.prefix, '')) + 1) AS INTEGER)
      ELSE 0
    END
  ), v_config.starting_number - 1) + 1
  INTO v_next_num
  FROM bill_of_materials
  WHERE company_id = p_company_id;
  
  v_formatted_number := COALESCE(v_config.prefix, '') || LPAD(v_next_num::TEXT, v_config.num_digits, '0');
  
  RETURN v_formatted_number;
END;
$function$;

-- Add updated_at trigger for bill_of_materials
CREATE TRIGGER update_bill_of_materials_updated_at
  BEFORE UPDATE ON public.bill_of_materials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();