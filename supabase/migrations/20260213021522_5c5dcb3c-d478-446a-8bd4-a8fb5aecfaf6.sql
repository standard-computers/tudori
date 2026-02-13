-- Create a function to execute analytics queries safely
CREATE OR REPLACE FUNCTION public.execute_analytics_query(query_text text, query_params jsonb DEFAULT '[]'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Only allow SELECT queries
  IF NOT (lower(trim(query_text)) LIKE 'select%') THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;
  
  -- Block dangerous keywords
  IF lower(query_text) ~ '(insert|update|delete|drop|alter|create|truncate|grant|revoke)' THEN
    RAISE EXCEPTION 'Modification queries are not allowed';
  END IF;

  -- Execute the query and return results as JSON
  EXECUTE format('SELECT jsonb_agg(row_to_json(t)) FROM (%s) t', query_text)
  USING 
    CASE WHEN jsonb_array_length(query_params) > 0 THEN query_params->0 ELSE NULL END,
    CASE WHEN jsonb_array_length(query_params) > 1 THEN query_params->1 ELSE NULL END,
    CASE WHEN jsonb_array_length(query_params) > 2 THEN query_params->2 ELSE NULL END,
    CASE WHEN jsonb_array_length(query_params) > 3 THEN query_params->3 ELSE NULL END,
    CASE WHEN jsonb_array_length(query_params) > 4 THEN query_params->4 ELSE NULL END,
    CASE WHEN jsonb_array_length(query_params) > 5 THEN query_params->5 ELSE NULL END,
    CASE WHEN jsonb_array_length(query_params) > 6 THEN query_params->6 ELSE NULL END,
    CASE WHEN jsonb_array_length(query_params) > 7 THEN query_params->7 ELSE NULL END,
    CASE WHEN jsonb_array_length(query_params) > 8 THEN query_params->8 ELSE NULL END,
    CASE WHEN jsonb_array_length(query_params) > 9 THEN query_params->9 ELSE NULL END
  INTO result;
  
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;