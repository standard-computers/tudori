CREATE OR REPLACE FUNCTION public.platform_delete_company(p_company_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record; pass int; remaining int; deleted_total int := 0; n int;
BEGIN
  FOR pass IN 1..8 LOOP
    remaining := 0;
    FOR r IN
      SELECT c.table_name FROM information_schema.columns c
      JOIN information_schema.tables t ON t.table_schema=c.table_schema AND t.table_name=c.table_name AND t.table_type='BASE TABLE'
      WHERE c.table_schema='public' AND c.column_name='company_id' AND c.table_name <> 'companies'
    LOOP
      BEGIN
        EXECUTE format('DELETE FROM public.%I WHERE company_id = $1', r.table_name) USING p_company_id;
        GET DIAGNOSTICS n = ROW_COUNT; deleted_total := deleted_total + n;
      EXCEPTION WHEN foreign_key_violation THEN
        remaining := remaining + 1;
      END;
    END LOOP;
    EXIT WHEN remaining = 0;
  END LOOP;
  IF remaining > 0 THEN
    RAISE EXCEPTION 'Could not delete all company data (% tables blocked by references)', remaining;
  END IF;
  DELETE FROM public.companies WHERE id = p_company_id;
  RETURN jsonb_build_object('deleted_rows', deleted_total);
END $$;
REVOKE ALL ON FUNCTION public.platform_delete_company(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_delete_company(uuid) TO service_role;