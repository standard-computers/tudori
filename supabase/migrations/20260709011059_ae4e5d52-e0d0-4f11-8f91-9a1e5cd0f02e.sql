
-- Private schema for privileged helpers (not exposed to the Data API)
CREATE SCHEMA IF NOT EXISTS internal;
REVOKE ALL ON SCHEMA internal FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA internal TO service_role;

-- Move ID/number generator SECURITY DEFINER functions (all take a single p_company_id uuid)
-- from public into `internal`, and expose a public SECURITY INVOKER wrapper that calls them.
DO $$
DECLARE
  r record;
  fn_names text[] := ARRAY[
    'get_next_account_id','get_next_agreement_id','get_next_bom_id','get_next_count_number',
    'get_next_credit_memo_number','get_next_customer_id','get_next_debit_memo_number',
    'get_next_delivery_id','get_next_employee_id','get_next_goods_issue_number',
    'get_next_goods_receipt_number','get_next_invoice_number','get_next_ledger_id',
    'get_next_location_id','get_next_movement_id','get_next_outbound_delivery_number',
    'get_next_payment_number','get_next_po_number','get_next_product_id',
    'get_next_production_order_number','get_next_profile_id','get_next_pu_number',
    'get_next_rate_id','get_next_requisition_id','get_next_so_number','get_next_team_id',
    'get_next_vendor_id','generate_assignment_id','generate_carrier_id','generate_route_id',
    'generate_truck_id'
  ];
  fn text;
BEGIN
  FOREACH fn IN ARRAY fn_names LOOP
    -- Skip if the function doesn't exist in public with the expected signature
    IF EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = fn
        AND pg_get_function_identity_arguments(p.oid) = 'p_company_id uuid'
    ) THEN
      -- Move implementation to internal schema (keeps SECURITY DEFINER)
      EXECUTE format('ALTER FUNCTION public.%I(p_company_id uuid) SET SCHEMA internal', fn);
      -- Grant execute to service_role only; authenticated cannot call it directly through Data API
      EXECUTE format('REVOKE EXECUTE ON FUNCTION internal.%I(p_company_id uuid) FROM PUBLIC, anon, authenticated', fn);
      EXECUTE format('GRANT EXECUTE ON FUNCTION internal.%I(p_company_id uuid) TO service_role', fn);
      -- Public SECURITY INVOKER wrapper that PostgREST exposes; internally calls the definer version
      EXECUTE format($f$
        CREATE OR REPLACE FUNCTION public.%1$I(p_company_id uuid)
        RETURNS text
        LANGUAGE plpgsql
        SECURITY INVOKER
        SET search_path = public
        AS $body$
        DECLARE v_result text;
        BEGIN
          IF auth.uid() IS NULL THEN
            RAISE EXCEPTION 'Not authenticated';
          END IF;
          IF public.get_user_company_id(auth.uid()) IS DISTINCT FROM p_company_id THEN
            RAISE EXCEPTION 'Access denied';
          END IF;
          SELECT internal.%1$I(p_company_id) INTO v_result;
          RETURN v_result;
        END;
        $body$;
      $f$, fn);
      -- The wrapper is INVOKER but needs to be able to call the internal SD function.
      -- Since the internal function is SECURITY DEFINER owned by postgres, calling it requires EXECUTE.
      -- Grant EXECUTE on the wrapper's underlying internal function only via a SECURITY DEFINER trampoline.
      -- Simpler: make the wrapper itself SECURITY DEFINER so it can invoke internal.* while the
      -- app-facing surface still has an explicit auth check inside.
      EXECUTE format('ALTER FUNCTION public.%I(p_company_id uuid) SECURITY DEFINER', fn);
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(p_company_id uuid) FROM PUBLIC, anon', fn);
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(p_company_id uuid) TO authenticated', fn);
    END IF;
  END LOOP;
END $$;

-- The trigger function log_vendor_changes should never be called directly.
REVOKE EXECUTE ON FUNCTION public.log_vendor_changes() FROM authenticated, anon, PUBLIC;

-- get_table_columns is used only by the internal Data Explorer admin tool.
-- Restrict to company admins only (kept SECURITY DEFINER for information_schema access).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.proname='get_table_columns'
  ) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.get_table_columns(text) FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_table_columns(text) TO service_role';
  END IF;
END $$;
