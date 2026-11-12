CREATE OR REPLACE FUNCTION public.create_delivery_packages(p_company_id uuid, p_delivery_id uuid, p_count integer)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_number text;
  v_index integer;
BEGIN
  IF auth.uid() IS NULL OR public.get_user_company_id(auth.uid()) IS DISTINCT FROM p_company_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  IF p_count IS NULL OR p_count < 1 THEN
    RAISE EXCEPTION 'Enter a positive whole number of packages';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.deliveries WHERE id = p_delivery_id AND company_id = p_company_id) THEN
    RAISE EXCEPTION 'Delivery not found';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_company_id::text || ':packaging_unit', 0));
  FOR v_index IN 1..p_count LOOP
    v_number := public.get_next_pu_number(p_company_id);
    IF v_number IS NULL THEN
      RAISE EXCEPTION 'Failed to generate PU number';
    END IF;
    INSERT INTO public.packaging_units (pu_number, company_id, delivery_id, product_id, quantity, status)
    VALUES (v_number, p_company_id, p_delivery_id, NULL, 0, 'active');
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.create_delivery_packages(uuid, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_delivery_packages(uuid, uuid, integer) TO authenticated, service_role;