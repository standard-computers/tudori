
-- Create trucks table
CREATE TABLE public.trucks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  truck_id TEXT NOT NULL,
  carrier_id UUID NOT NULL REFERENCES public.carriers(id),
  source_location_id UUID REFERENCES public.locations(id),
  destination_location_id UUID REFERENCES public.locations(id),
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, truck_id)
);

-- Enable RLS
ALTER TABLE public.trucks ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view trucks in their company"
  ON public.trucks FOR SELECT TO authenticated
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can create trucks in their company"
  ON public.trucks FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can update trucks in their company"
  ON public.trucks FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can delete trucks in their company"
  ON public.trucks FOR DELETE TO authenticated
  USING (company_id = get_user_company_id(auth.uid()));

-- Updated at trigger
CREATE TRIGGER update_trucks_updated_at
  BEFORE UPDATE ON public.trucks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Generate truck ID RPC
CREATE OR REPLACE FUNCTION public.generate_truck_id(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_config document_id_config%ROWTYPE;
  v_next_number integer;
  v_max_number integer;
  v_prefix text;
  v_num_digits integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('truck_' || p_company_id::text));

  SELECT * INTO v_config
  FROM document_id_config
  WHERE company_id = p_company_id AND document_type = 'truck'
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO document_id_config (company_id, document_type, prefix, num_digits, starting_number)
    VALUES (p_company_id, 'truck', 'TRK-', 4, 1)
    RETURNING * INTO v_config;
  END IF;

  v_prefix := COALESCE(v_config.prefix, '');
  v_num_digits := v_config.num_digits;

  SELECT COALESCE(MAX(
    CASE
      WHEN truck_id ~ ('^' || v_prefix || '[0-9]+$')
      THEN CAST(SUBSTRING(truck_id FROM LENGTH(v_prefix) + 1) AS integer)
      ELSE 0
    END
  ), v_config.starting_number - 1) + 1
  INTO v_next_number
  FROM trucks
  WHERE company_id = p_company_id;

  RETURN v_prefix || LPAD(v_next_number::text, v_num_digits, '0');
END;
$$;
