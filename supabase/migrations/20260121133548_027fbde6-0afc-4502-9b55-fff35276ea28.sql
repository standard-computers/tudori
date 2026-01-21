-- Update get_next_so_number to use document_id_config
CREATE OR REPLACE FUNCTION public.get_next_so_number(p_company_id uuid)
RETURNS character varying
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_config document_id_config%ROWTYPE;
  v_next_number INTEGER;
  v_formatted_number VARCHAR(50);
BEGIN
  -- Validate user belongs to company
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid() AND company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'Access denied: User does not belong to this company';
  END IF;

  SELECT * INTO v_config 
  FROM document_id_config 
  WHERE company_id = p_company_id AND document_type = 'sales_order';
  
  IF NOT FOUND THEN
    INSERT INTO document_id_config (company_id, document_type, prefix, starting_number, num_digits)
    VALUES (p_company_id, 'sales_order', 'SO-', 1, 5)
    RETURNING * INTO v_config;
  END IF;
  
  SELECT COALESCE(MAX(
    CASE 
      WHEN so_number ~ ('^' || COALESCE(v_config.prefix, '') || '[0-9]+$')
      THEN CAST(SUBSTRING(so_number FROM LENGTH(COALESCE(v_config.prefix, '')) + 1) AS INTEGER)
      ELSE 0
    END
  ), v_config.starting_number - 1) + 1
  INTO v_next_number
  FROM sales_orders
  WHERE company_id = p_company_id;
  
  v_formatted_number := COALESCE(v_config.prefix, '') || LPAD(v_next_number::TEXT, v_config.num_digits, '0');
  
  RETURN v_formatted_number;
END;
$function$;

-- Update get_next_account_id to use document_id_config
CREATE OR REPLACE FUNCTION public.get_next_account_id(p_company_id uuid)
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
  -- Validate user belongs to company
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid() AND company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'Access denied: User does not belong to this company';
  END IF;

  SELECT * INTO v_config 
  FROM document_id_config 
  WHERE company_id = p_company_id AND document_type = 'account';
  
  IF NOT FOUND THEN
    INSERT INTO document_id_config (company_id, document_type, prefix, starting_number, num_digits)
    VALUES (p_company_id, 'account', '', 1, 4)
    RETURNING * INTO v_config;
  END IF;
  
  SELECT COALESCE(MAX(
    CASE 
      WHEN account_id ~ ('^' || COALESCE(v_config.prefix, '') || '[0-9]+$')
      THEN CAST(SUBSTRING(account_id FROM LENGTH(COALESCE(v_config.prefix, '')) + 1) AS INTEGER)
      ELSE 0
    END
  ), v_config.starting_number - 1) + 1
  INTO v_next_number
  FROM accounts
  WHERE company_id = p_company_id;
  
  v_formatted_number := COALESCE(v_config.prefix, '') || LPAD(v_next_number::TEXT, v_config.num_digits, '0');
  
  RETURN v_formatted_number;
END;
$function$;

-- Update get_next_invoice_number to use document_id_config
CREATE OR REPLACE FUNCTION public.get_next_invoice_number(p_company_id uuid)
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
  -- Validate user belongs to company
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid() AND company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'Access denied: User does not belong to this company';
  END IF;

  SELECT * INTO v_config 
  FROM document_id_config 
  WHERE company_id = p_company_id AND document_type = 'invoice';
  
  IF NOT FOUND THEN
    INSERT INTO document_id_config (company_id, document_type, prefix, starting_number, num_digits)
    VALUES (p_company_id, 'invoice', 'INV-', 1, 4)
    RETURNING * INTO v_config;
  END IF;
  
  SELECT COALESCE(MAX(
    CASE 
      WHEN invoice_number ~ ('^' || COALESCE(v_config.prefix, '') || '[0-9]+$')
      THEN CAST(SUBSTRING(invoice_number FROM LENGTH(COALESCE(v_config.prefix, '')) + 1) AS INTEGER)
      ELSE 0
    END
  ), v_config.starting_number - 1) + 1
  INTO v_next_number
  FROM invoices
  WHERE company_id = p_company_id;
  
  v_formatted_number := COALESCE(v_config.prefix, '') || LPAD(v_next_number::TEXT, v_config.num_digits, '0');
  
  RETURN v_formatted_number;
END;
$function$;

-- Update get_next_credit_memo_number to use document_id_config
CREATE OR REPLACE FUNCTION public.get_next_credit_memo_number(p_company_id uuid)
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
  -- Validate user belongs to company
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid() AND company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'Access denied: User does not belong to this company';
  END IF;

  SELECT * INTO v_config 
  FROM document_id_config 
  WHERE company_id = p_company_id AND document_type = 'credit_memo';
  
  IF NOT FOUND THEN
    INSERT INTO document_id_config (company_id, document_type, prefix, starting_number, num_digits)
    VALUES (p_company_id, 'credit_memo', 'CM-', 1, 4)
    RETURNING * INTO v_config;
  END IF;
  
  SELECT COALESCE(MAX(
    CASE 
      WHEN memo_number ~ ('^' || COALESCE(v_config.prefix, '') || '[0-9]+$')
      THEN CAST(SUBSTRING(memo_number FROM LENGTH(COALESCE(v_config.prefix, '')) + 1) AS INTEGER)
      ELSE 0
    END
  ), v_config.starting_number - 1) + 1
  INTO v_next_number
  FROM credit_memos
  WHERE company_id = p_company_id;
  
  v_formatted_number := COALESCE(v_config.prefix, '') || LPAD(v_next_number::TEXT, v_config.num_digits, '0');
  
  RETURN v_formatted_number;
END;
$function$;

-- Update get_next_debit_memo_number to use document_id_config
CREATE OR REPLACE FUNCTION public.get_next_debit_memo_number(p_company_id uuid)
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
  -- Validate user belongs to company
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid() AND company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'Access denied: User does not belong to this company';
  END IF;

  SELECT * INTO v_config 
  FROM document_id_config 
  WHERE company_id = p_company_id AND document_type = 'debit_memo';
  
  IF NOT FOUND THEN
    INSERT INTO document_id_config (company_id, document_type, prefix, starting_number, num_digits)
    VALUES (p_company_id, 'debit_memo', 'DM-', 1, 4)
    RETURNING * INTO v_config;
  END IF;
  
  SELECT COALESCE(MAX(
    CASE 
      WHEN memo_number ~ ('^' || COALESCE(v_config.prefix, '') || '[0-9]+$')
      THEN CAST(SUBSTRING(memo_number FROM LENGTH(COALESCE(v_config.prefix, '')) + 1) AS INTEGER)
      ELSE 0
    END
  ), v_config.starting_number - 1) + 1
  INTO v_next_number
  FROM debit_memos
  WHERE company_id = p_company_id;
  
  v_formatted_number := COALESCE(v_config.prefix, '') || LPAD(v_next_number::TEXT, v_config.num_digits, '0');
  
  RETURN v_formatted_number;
END;
$function$;

-- Update get_next_goods_receipt_number to also respect starting_number
CREATE OR REPLACE FUNCTION public.get_next_goods_receipt_number(p_company_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config document_id_config%ROWTYPE;
  v_next_num INTEGER;
  v_formatted_number TEXT;
BEGIN
  -- Verify user belongs to this company
  IF get_user_company_id(auth.uid()) != p_company_id THEN
    RAISE EXCEPTION 'Access denied: User does not belong to this company';
  END IF;

  SELECT * INTO v_config
  FROM document_id_config
  WHERE company_id = p_company_id AND document_type = 'goods_receipt';
  
  IF NOT FOUND THEN
    INSERT INTO document_id_config (company_id, document_type, prefix, starting_number, num_digits)
    VALUES (p_company_id, 'goods_receipt', 'GR-', 1, 4)
    RETURNING * INTO v_config;
  END IF;
  
  SELECT COALESCE(MAX(
    CASE 
      WHEN receipt_number ~ ('^' || COALESCE(v_config.prefix, '') || '[0-9]+$')
      THEN CAST(SUBSTRING(receipt_number FROM LENGTH(COALESCE(v_config.prefix, '')) + 1) AS INTEGER)
      ELSE 0
    END
  ), v_config.starting_number - 1) + 1
  INTO v_next_num
  FROM goods_receipts
  WHERE company_id = p_company_id;
  
  v_formatted_number := COALESCE(v_config.prefix, '') || LPAD(v_next_num::TEXT, v_config.num_digits, '0');
  
  RETURN v_formatted_number;
END;
$$;

-- Update get_next_goods_issue_number to also respect starting_number
CREATE OR REPLACE FUNCTION public.get_next_goods_issue_number(p_company_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config document_id_config%ROWTYPE;
  v_next_num INTEGER;
  v_formatted_number TEXT;
BEGIN
  -- Verify user belongs to this company
  IF get_user_company_id(auth.uid()) != p_company_id THEN
    RAISE EXCEPTION 'Access denied: User does not belong to this company';
  END IF;

  SELECT * INTO v_config
  FROM document_id_config
  WHERE company_id = p_company_id AND document_type = 'goods_issue';
  
  IF NOT FOUND THEN
    INSERT INTO document_id_config (company_id, document_type, prefix, starting_number, num_digits)
    VALUES (p_company_id, 'goods_issue', 'GI-', 1, 4)
    RETURNING * INTO v_config;
  END IF;
  
  SELECT COALESCE(MAX(
    CASE 
      WHEN issue_number ~ ('^' || COALESCE(v_config.prefix, '') || '[0-9]+$')
      THEN CAST(SUBSTRING(issue_number FROM LENGTH(COALESCE(v_config.prefix, '')) + 1) AS INTEGER)
      ELSE 0
    END
  ), v_config.starting_number - 1) + 1
  INTO v_next_num
  FROM goods_issues
  WHERE company_id = p_company_id;
  
  v_formatted_number := COALESCE(v_config.prefix, '') || LPAD(v_next_num::TEXT, v_config.num_digits, '0');
  
  RETURN v_formatted_number;
END;
$$;