-- Create locations table
CREATE TABLE public.locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  location_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'Office',
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'United States',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, location_id)
);

-- Create sequence for auto-increment location IDs per company
CREATE SEQUENCE public.location_id_seq START 1;

-- Enable RLS
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view locations in their company"
ON public.locations FOR SELECT
USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Admins can create locations"
ON public.locations FOR INSERT
WITH CHECK (is_company_admin(auth.uid(), company_id));

CREATE POLICY "Admins can update locations"
ON public.locations FOR UPDATE
USING (is_company_admin(auth.uid(), company_id));

CREATE POLICY "Admins can delete locations"
ON public.locations FOR DELETE
USING (is_company_admin(auth.uid(), company_id));

-- Function to get next location ID for a company
CREATE OR REPLACE FUNCTION public.get_next_location_id(p_company_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(location_id AS INTEGER)), 0) + 1
  INTO next_num
  FROM public.locations
  WHERE company_id = p_company_id;
  
  RETURN LPAD(next_num::TEXT, 4, '0');
END;
$$;