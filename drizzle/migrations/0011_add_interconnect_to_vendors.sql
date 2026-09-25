ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS interconnect_id uuid REFERENCES public.interconnects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_vendors_interconnect_id ON public.vendors(interconnect_id);

CREATE OR REPLACE FUNCTION public.list_interconnect_partners()
RETURNS TABLE(interconnect_uuid uuid, interconnect_code text, interconnect_name text, partner_company_id uuid, name text, phone text, website text, address_line1 text, address_line2 text, city text, state text, postal_code text, country text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT i.id, i.interconnect_id, i.name, c.id, c.name, c.phone, c.website, c.address_line1, c.address_line2, c.city, c.state, c.postal_code, c.country
  FROM public.interconnects i
  JOIN public.companies c ON c.id = i.partner_company_id
  WHERE i.company_id = public.get_user_company_id(auth.uid())
    AND i.is_active = true
    AND i.status = 'connected'
  ORDER BY c.name;
$$;
REVOKE EXECUTE ON FUNCTION public.list_interconnect_partners() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.list_interconnect_partners() TO authenticated;