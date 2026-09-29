ALTER TABLE public.products ADD COLUMN interconnect_id uuid REFERENCES public.interconnects(id) ON DELETE SET NULL;
ALTER TABLE public.products ADD COLUMN interconnect_product_id uuid;
CREATE INDEX idx_products_interconnect_id ON public.products(interconnect_id);

CREATE OR REPLACE FUNCTION public.list_interconnect_products()
RETURNS TABLE(interconnect_uuid uuid, interconnect_code text, vendor_id uuid, vendor_name text, source_product_id uuid, product_code text, name text, description text, link text, category text, price numeric, unit text, is_batched boolean, min_shelf_life_days integer, keep_inventory boolean, is_consumable boolean, width numeric, length numeric, height numeric, weight numeric, width_uom text, length_uom text, height_uom text, weight_uom text, transport_time_days integer, manufacture_time_days integer, lead_time_days integer, hazardous boolean, serialized boolean, is_pos_available boolean, uoms jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT i.id, i.interconnect_id, v.id, v.name, p.id, p.product_id, p.name, p.description, p.link, p.category, p.price, p.unit,
    p.is_batched, p.min_shelf_life_days, p.keep_inventory, p.is_consumable, p.width, p.length, p.height, p.weight,
    p.width_uom, p.length_uom, p.height_uom, p.weight_uom, p.transport_time_days, p.manufacture_time_days, p.lead_time_days,
    p.hazardous, p.serialized, p.is_pos_available,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('name', u.name, 'abbreviation', u.abbreviation, 'conversion_factor', u.conversion_factor, 'lower_uom', u.lower_uom)) FROM public.product_uoms u WHERE u.product_id = p.id), '[]'::jsonb)
  FROM public.vendors v
  JOIN public.interconnects i ON i.id = v.interconnect_id AND i.is_active = true AND i.status = 'connected'
  JOIN public.products p ON p.company_id = i.partner_company_id AND COALESCE(p.status,'active') = 'active'
  WHERE v.company_id = public.get_user_company_id(auth.uid())
    AND i.company_id = v.company_id
  ORDER BY v.name, p.name;
$$;
REVOKE ALL ON FUNCTION public.list_interconnect_products() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_interconnect_products() TO authenticated;