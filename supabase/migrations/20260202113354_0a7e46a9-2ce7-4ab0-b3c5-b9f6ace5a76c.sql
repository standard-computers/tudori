-- Create material_movements table to track inventory line movements
CREATE TABLE public.material_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  movement_id TEXT NOT NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  pu_id UUID REFERENCES public.packaging_units(id) ON DELETE SET NULL,
  bin_id UUID REFERENCES public.bins(id) ON DELETE SET NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  movement_type TEXT NOT NULL, -- 'receipt', 'issue', 'move_in', 'move_out', 'adjustment'
  source_bin_id UUID REFERENCES public.bins(id) ON DELETE SET NULL,
  destination_bin_id UUID REFERENCES public.bins(id) ON DELETE SET NULL,
  reference_type TEXT, -- 'goods_receipt', 'goods_issue', 'inventory_transfer', 'adjustment'
  reference_id UUID,
  reference_number TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create index for faster queries
CREATE INDEX idx_material_movements_company ON public.material_movements(company_id);
CREATE INDEX idx_material_movements_location ON public.material_movements(location_id);
CREATE INDEX idx_material_movements_product ON public.material_movements(product_id);
CREATE INDEX idx_material_movements_pu ON public.material_movements(pu_id);
CREATE INDEX idx_material_movements_bin ON public.material_movements(bin_id);
CREATE INDEX idx_material_movements_created ON public.material_movements(created_at DESC);

-- Enable RLS
ALTER TABLE public.material_movements ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view material movements for their company"
ON public.material_movements FOR SELECT
USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert material movements for their company"
ON public.material_movements FOR INSERT
WITH CHECK (company_id = get_user_company_id(auth.uid()));

-- Function to generate movement_id
CREATE OR REPLACE FUNCTION public.get_next_movement_id(p_company_id uuid)
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
  WHERE company_id = p_company_id AND document_type = 'material_movement';
  
  IF NOT FOUND THEN
    INSERT INTO document_id_config (company_id, document_type, prefix, starting_number, num_digits)
    VALUES (p_company_id, 'material_movement', 'MF-', 1, 6)
    RETURNING * INTO v_config;
  END IF;
  
  SELECT COALESCE(MAX(
    CASE 
      WHEN movement_id ~ ('^' || COALESCE(v_config.prefix, '') || '[0-9]+$')
      THEN CAST(SUBSTRING(movement_id FROM LENGTH(COALESCE(v_config.prefix, '')) + 1) AS INTEGER)
      ELSE 0
    END
  ), v_config.starting_number - 1) + 1
  INTO v_next_num
  FROM material_movements
  WHERE company_id = p_company_id;
  
  v_formatted_number := COALESCE(v_config.prefix, '') || LPAD(v_next_num::TEXT, v_config.num_digits, '0');
  
  RETURN v_formatted_number;
END;
$$;