-- Create packaging_units table for tracking HU/PU numbers
CREATE TABLE public.packaging_units (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pu_number TEXT NOT NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add pu_id to goods_receipt_items
ALTER TABLE public.goods_receipt_items
ADD COLUMN pu_id UUID REFERENCES public.packaging_units(id) ON DELETE SET NULL;

-- Add pu_id to goods_issue_items
ALTER TABLE public.goods_issue_items
ADD COLUMN pu_id UUID REFERENCES public.packaging_units(id) ON DELETE SET NULL;

-- Add pu_id to inventory table
ALTER TABLE public.inventory
ADD COLUMN pu_id UUID REFERENCES public.packaging_units(id) ON DELETE SET NULL;

-- Add pu_id to delivery_items for ASN packing
ALTER TABLE public.delivery_items
ADD COLUMN pu_id UUID REFERENCES public.packaging_units(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.packaging_units ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for packaging_units
CREATE POLICY "Users can view packaging units from their company"
ON public.packaging_units
FOR SELECT
USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can create packaging units for their company"
ON public.packaging_units
FOR INSERT
WITH CHECK (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can update packaging units from their company"
ON public.packaging_units
FOR UPDATE
USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can delete packaging units from their company"
ON public.packaging_units
FOR DELETE
USING (company_id = get_user_company_id(auth.uid()));

-- Create index on pu_number for faster lookups
CREATE INDEX idx_packaging_units_pu_number ON public.packaging_units(pu_number);
CREATE INDEX idx_packaging_units_company_id ON public.packaging_units(company_id);

-- Create function to generate next PU number
CREATE OR REPLACE FUNCTION public.get_next_pu_number(p_company_id uuid)
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
  -- Verify user belongs to this company
  IF get_user_company_id(auth.uid()) != p_company_id THEN
    RAISE EXCEPTION 'Access denied: User does not belong to this company';
  END IF;

  SELECT * INTO v_config
  FROM document_id_config
  WHERE company_id = p_company_id AND document_type = 'packaging_unit';
  
  IF NOT FOUND THEN
    INSERT INTO document_id_config (company_id, document_type, prefix, starting_number, num_digits)
    VALUES (p_company_id, 'packaging_unit', 'PU-', 1, 6)
    RETURNING * INTO v_config;
  END IF;
  
  SELECT COALESCE(MAX(
    CASE 
      WHEN pu_number ~ ('^' || COALESCE(v_config.prefix, '') || '[0-9]+$')
      THEN CAST(SUBSTRING(pu_number FROM LENGTH(COALESCE(v_config.prefix, '')) + 1) AS INTEGER)
      ELSE 0
    END
  ), v_config.starting_number - 1) + 1
  INTO v_next_num
  FROM packaging_units
  WHERE company_id = p_company_id;
  
  v_formatted_number := COALESCE(v_config.prefix, '') || LPAD(v_next_num::TEXT, v_config.num_digits, '0');
  
  RETURN v_formatted_number;
END;
$$;

-- Create trigger for updated_at
CREATE TRIGGER update_packaging_units_updated_at
BEFORE UPDATE ON public.packaging_units
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();