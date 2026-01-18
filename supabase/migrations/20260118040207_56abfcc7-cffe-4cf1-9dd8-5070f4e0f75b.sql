-- Create vendors table
CREATE TABLE public.vendors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  vendor_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'Supplier',
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'United States',
  website TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, vendor_id)
);

-- Enable RLS
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view vendors in their company"
ON public.vendors FOR SELECT
USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Admins can create vendors"
ON public.vendors FOR INSERT
WITH CHECK (is_company_admin(auth.uid(), company_id));

CREATE POLICY "Admins can update vendors"
ON public.vendors FOR UPDATE
USING (is_company_admin(auth.uid(), company_id));

CREATE POLICY "Admins can delete vendors"
ON public.vendors FOR DELETE
USING (is_company_admin(auth.uid(), company_id));

-- Function to get next vendor ID for a company
CREATE OR REPLACE FUNCTION public.get_next_vendor_id(p_company_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(vendor_id AS INTEGER)), 0) + 1
  INTO next_num
  FROM public.vendors
  WHERE company_id = p_company_id;
  
  RETURN LPAD(next_num::TEXT, 4, '0');
END;
$$;