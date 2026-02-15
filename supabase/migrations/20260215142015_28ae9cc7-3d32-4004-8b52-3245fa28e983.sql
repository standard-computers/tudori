
CREATE OR REPLACE FUNCTION public.execute_analytics_query(query_text text, query_params jsonb DEFAULT '[]'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
  caller_company_id uuid;
BEGIN
  -- Verify authenticated user
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get caller's company
  SELECT company_id INTO caller_company_id FROM profiles WHERE user_id = auth.uid();
  IF caller_company_id IS NULL THEN
    RAISE EXCEPTION 'No company access';
  END IF;

  -- Only allow SELECT queries
  IF NOT (lower(trim(query_text)) LIKE 'select%') THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;
  
  -- Block dangerous keywords
  IF lower(query_text) ~ '(insert|update|delete|drop|alter|create|truncate|grant|revoke|union|exec)' THEN
    RAISE EXCEPTION 'Modification queries are not allowed';
  END IF;

  -- Verify the query filters by the caller's company_id (first param must match)
  IF jsonb_array_length(query_params) < 1 OR (query_params->>0)::uuid != caller_company_id THEN
    RAISE EXCEPTION 'Query must be scoped to your company';
  END IF;

  -- Execute the query and return results as JSON
  EXECUTE format('SELECT jsonb_agg(row_to_json(t)) FROM (%s) t', query_text)
  USING 
    CASE WHEN jsonb_array_length(query_params) > 0 THEN query_params->>0 ELSE NULL END,
    CASE WHEN jsonb_array_length(query_params) > 1 THEN query_params->>1 ELSE NULL END,
    CASE WHEN jsonb_array_length(query_params) > 2 THEN query_params->>2 ELSE NULL END,
    CASE WHEN jsonb_array_length(query_params) > 3 THEN query_params->>3 ELSE NULL END,
    CASE WHEN jsonb_array_length(query_params) > 4 THEN query_params->>4 ELSE NULL END,
    CASE WHEN jsonb_array_length(query_params) > 5 THEN query_params->>5 ELSE NULL END,
    CASE WHEN jsonb_array_length(query_params) > 6 THEN query_params->>6 ELSE NULL END,
    CASE WHEN jsonb_array_length(query_params) > 7 THEN query_params->>7 ELSE NULL END,
    CASE WHEN jsonb_array_length(query_params) > 8 THEN query_params->>8 ELSE NULL END,
    CASE WHEN jsonb_array_length(query_params) > 9 THEN query_params->>9 ELSE NULL END
  INTO result;
  
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;
