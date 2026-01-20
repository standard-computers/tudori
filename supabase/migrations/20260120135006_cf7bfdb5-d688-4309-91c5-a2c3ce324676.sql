-- Add company membership validation to all ID generation functions
-- This ensures users can only generate IDs for companies they belong to

-- Update get_next_vendor_id
CREATE OR REPLACE FUNCTION public.get_next_vendor_id(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  next_num INTEGER;
BEGIN
  -- Validate user belongs to company
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid() AND company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'Access denied: User does not belong to this company';
  END IF;

  SELECT COALESCE(MAX(CAST(vendor_id AS INTEGER)), 0) + 1
  INTO next_num
  FROM public.vendors
  WHERE company_id = p_company_id;
  
  RETURN LPAD(next_num::TEXT, 4, '0');
END;
$function$;

-- Update get_next_product_id
CREATE OR REPLACE FUNCTION public.get_next_product_id(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  next_num INTEGER;
BEGIN
  -- Validate user belongs to company
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid() AND company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'Access denied: User does not belong to this company';
  END IF;

  SELECT COALESCE(MAX(CAST(product_id AS INTEGER)), 0) + 1
  INTO next_num
  FROM public.products
  WHERE company_id = p_company_id;
  
  RETURN LPAD(next_num::TEXT, 4, '0');
END;
$function$;

-- Update get_next_customer_id
CREATE OR REPLACE FUNCTION public.get_next_customer_id(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  next_num INTEGER;
BEGIN
  -- Validate user belongs to company
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid() AND company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'Access denied: User does not belong to this company';
  END IF;

  SELECT COALESCE(MAX(CAST(customer_id AS INTEGER)), 0) + 1
  INTO next_num
  FROM public.customers
  WHERE company_id = p_company_id;
  
  RETURN LPAD(next_num::TEXT, 4, '0');
END;
$function$;

-- Update get_next_location_id
CREATE OR REPLACE FUNCTION public.get_next_location_id(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  next_num INTEGER;
BEGIN
  -- Validate user belongs to company
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid() AND company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'Access denied: User does not belong to this company';
  END IF;

  SELECT COALESCE(MAX(CAST(location_id AS INTEGER)), 0) + 1
  INTO next_num
  FROM public.locations
  WHERE company_id = p_company_id;
  
  RETURN LPAD(next_num::TEXT, 4, '0');
END;
$function$;

-- Update get_next_requisition_id
CREATE OR REPLACE FUNCTION public.get_next_requisition_id(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  next_num INTEGER;
BEGIN
  -- Validate user belongs to company
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid() AND company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'Access denied: User does not belong to this company';
  END IF;

  SELECT COALESCE(MAX(CAST(requisition_id AS INTEGER)), 0) + 1
  INTO next_num
  FROM public.requisitions
  WHERE company_id = p_company_id;
  
  RETURN LPAD(next_num::TEXT, 4, '0');
END;
$function$;

-- Update get_next_po_number
CREATE OR REPLACE FUNCTION public.get_next_po_number(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  next_num INTEGER;
BEGIN
  -- Validate user belongs to company
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid() AND company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'Access denied: User does not belong to this company';
  END IF;

  SELECT COALESCE(MAX(CAST(SUBSTRING(po_number FROM 4) AS INTEGER)), 0) + 1
  INTO next_num
  FROM public.purchase_orders
  WHERE company_id = p_company_id;
  
  RETURN 'PO-' || LPAD(next_num::TEXT, 4, '0');
END;
$function$;

-- Update get_next_delivery_id
CREATE OR REPLACE FUNCTION public.get_next_delivery_id(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  next_num INTEGER;
BEGIN
  -- Validate user belongs to company
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid() AND company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'Access denied: User does not belong to this company';
  END IF;

  SELECT COALESCE(MAX(CAST(SUBSTRING(delivery_id FROM 5) AS INTEGER)), 0) + 1
  INTO next_num
  FROM public.deliveries
  WHERE company_id = p_company_id;
  
  RETURN 'DEL-' || LPAD(next_num::TEXT, 4, '0');
END;
$function$;

-- Update get_next_ledger_id
CREATE OR REPLACE FUNCTION public.get_next_ledger_id(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  next_num INTEGER;
BEGIN
  -- Validate user belongs to company
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid() AND company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'Access denied: User does not belong to this company';
  END IF;

  SELECT COALESCE(MAX(CAST(ledger_id AS INTEGER)), 0) + 1
  INTO next_num
  FROM public.ledgers
  WHERE company_id = p_company_id;
  
  RETURN LPAD(next_num::TEXT, 4, '0');
END;
$function$;

-- Update get_next_so_number
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

-- Update get_next_account_id
CREATE OR REPLACE FUNCTION public.get_next_account_id(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  next_num INTEGER;
BEGIN
  -- Validate user belongs to company
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid() AND company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'Access denied: User does not belong to this company';
  END IF;

  SELECT COALESCE(MAX(CAST(account_id AS INTEGER)), 0) + 1
  INTO next_num
  FROM public.accounts
  WHERE company_id = p_company_id;
  
  RETURN LPAD(next_num::TEXT, 4, '0');
END;
$function$;

-- Update get_next_invoice_number
CREATE OR REPLACE FUNCTION public.get_next_invoice_number(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  next_num INTEGER;
BEGIN
  -- Validate user belongs to company
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid() AND company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'Access denied: User does not belong to this company';
  END IF;

  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 5) AS INTEGER)), 0) + 1
  INTO next_num
  FROM public.invoices
  WHERE company_id = p_company_id;
  
  RETURN 'INV-' || LPAD(next_num::TEXT, 4, '0');
END;
$function$;

-- Update get_next_credit_memo_number
CREATE OR REPLACE FUNCTION public.get_next_credit_memo_number(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  next_num INTEGER;
BEGIN
  -- Validate user belongs to company
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid() AND company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'Access denied: User does not belong to this company';
  END IF;

  SELECT COALESCE(MAX(CAST(SUBSTRING(memo_number FROM 4) AS INTEGER)), 0) + 1
  INTO next_num
  FROM public.credit_memos
  WHERE company_id = p_company_id;
  
  RETURN 'CM-' || LPAD(next_num::TEXT, 4, '0');
END;
$function$;

-- Update get_next_debit_memo_number
CREATE OR REPLACE FUNCTION public.get_next_debit_memo_number(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  next_num INTEGER;
BEGIN
  -- Validate user belongs to company
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid() AND company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'Access denied: User does not belong to this company';
  END IF;

  SELECT COALESCE(MAX(CAST(SUBSTRING(memo_number FROM 4) AS INTEGER)), 0) + 1
  INTO next_num
  FROM public.debit_memos
  WHERE company_id = p_company_id;
  
  RETURN 'DM-' || LPAD(next_num::TEXT, 4, '0');
END;
$function$;