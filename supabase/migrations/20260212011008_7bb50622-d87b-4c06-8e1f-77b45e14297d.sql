
-- Add rate_id column to tax_rates
ALTER TABLE public.tax_rates ADD COLUMN rate_id text;

-- Backfill existing rates with sequential IDs
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY created_at) as rn
  FROM public.tax_rates
)
UPDATE public.tax_rates t
SET rate_id = LPAD(n.rn::text, 4, '0')
FROM numbered n
WHERE t.id = n.id;

-- Make rate_id NOT NULL after backfill
ALTER TABLE public.tax_rates ALTER COLUMN rate_id SET NOT NULL;

-- Create the next rate_id function
CREATE OR REPLACE FUNCTION public.get_next_rate_id(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_config document_id_config%ROWTYPE;
  v_next_number INTEGER;
  v_formatted_number TEXT;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid() AND company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'Access denied: User does not belong to this company';
  END IF;

  SELECT * INTO v_config
  FROM document_id_config
  WHERE company_id = p_company_id AND document_type = 'tax_rate';

  IF NOT FOUND THEN
    INSERT INTO document_id_config (company_id, document_type, prefix, starting_number, num_digits)
    VALUES (p_company_id, 'tax_rate', '', 1, 4)
    RETURNING * INTO v_config;
  END IF;

  SELECT COALESCE(MAX(
    CASE
      WHEN rate_id ~ ('^' || COALESCE(v_config.prefix, '') || '[0-9]+$')
      THEN CAST(SUBSTRING(rate_id FROM LENGTH(COALESCE(v_config.prefix, '')) + 1) AS INTEGER)
      ELSE 0
    END
  ), v_config.starting_number - 1) + 1
  INTO v_next_number
  FROM tax_rates
  WHERE company_id = p_company_id;

  v_formatted_number := COALESCE(v_config.prefix, '') || LPAD(v_next_number::TEXT, v_config.num_digits, '0');

  RETURN v_formatted_number;
END;
$$;
