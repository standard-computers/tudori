CREATE OR REPLACE FUNCTION public.get_table_columns(p_table text)
RETURNS TABLE(column_name text, data_type text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT column_name::text, data_type::text
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = p_table
  ORDER BY ordinal_position;
$$;

GRANT EXECUTE ON FUNCTION public.get_table_columns(text) TO authenticated;