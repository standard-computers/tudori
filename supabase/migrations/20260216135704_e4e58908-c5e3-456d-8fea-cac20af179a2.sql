
-- Add profile_id column
ALTER TABLE public.profiles ADD COLUMN profile_id text;

-- Create next profile_id function
CREATE OR REPLACE FUNCTION public.get_next_profile_id(p_company_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  WHERE company_id = p_company_id AND document_type = 'profile';

  IF NOT FOUND THEN
    INSERT INTO document_id_config (company_id, document_type, prefix, starting_number, num_digits)
    VALUES (p_company_id, 'profile', '', 1, 4)
    RETURNING * INTO v_config;
  END IF;

  SELECT COALESCE(MAX(
    CASE
      WHEN profile_id ~ ('^' || COALESCE(v_config.prefix, '') || '[0-9]+$')
      THEN CAST(SUBSTRING(profile_id FROM LENGTH(COALESCE(v_config.prefix, '')) + 1) AS INTEGER)
      ELSE 0
    END
  ), v_config.starting_number - 1) + 1
  INTO v_next_number
  FROM profiles
  WHERE company_id = p_company_id;

  v_formatted_number := COALESCE(v_config.prefix, '') || LPAD(v_next_number::TEXT, v_config.num_digits, '0');

  RETURN v_formatted_number;
END;
$function$;

-- Backfill existing profiles with sequential IDs per company
WITH ranked AS (
  SELECT id, company_id, ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY created_at) as rn
  FROM profiles
  WHERE profile_id IS NULL
)
UPDATE profiles p
SET profile_id = LPAD(r.rn::TEXT, 4, '0')
FROM ranked r
WHERE p.id = r.id;
