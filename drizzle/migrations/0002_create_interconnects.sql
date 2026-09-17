CREATE TABLE public.interconnects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  interconnect_id text NOT NULL,
  name text NOT NULL,
  auth_key text NOT NULL,
  role text NOT NULL DEFAULT 'owner',
  status text NOT NULL DEFAULT 'pending',
  partner_company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (company_id, interconnect_id)
);

CREATE INDEX idx_interconnects_ic_id ON public.interconnects(interconnect_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.interconnects TO authenticated;
GRANT ALL ON public.interconnects TO service_role;

ALTER TABLE public.interconnects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own company interconnects"
ON public.interconnects FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users insert own company interconnects"
ON public.interconnects FOR INSERT TO authenticated
WITH CHECK (company_id = public.get_user_company_id(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Users update own company interconnects"
ON public.interconnects FOR UPDATE TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users delete own company interconnects"
ON public.interconnects FOR DELETE TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()));

CREATE TRIGGER trg_interconnects_updated_at
BEFORE UPDATE ON public.interconnects
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Join an existing interconnect published by another organization
CREATE OR REPLACE FUNCTION public.join_interconnect(p_interconnect_id text, p_auth_key text, p_name text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company uuid;
  v_remote public.interconnects;
  v_new public.interconnects;
BEGIN
  v_company := public.get_user_company_id(auth.uid());
  IF v_company IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No company for current user');
  END IF;

  SELECT * INTO v_remote FROM public.interconnects
  WHERE interconnect_id = p_interconnect_id
    AND auth_key = p_auth_key
    AND company_id <> v_company
  ORDER BY created_at
  LIMIT 1;

  IF v_remote.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No interconnect found with that ID and auth key');
  END IF;

  IF EXISTS (SELECT 1 FROM public.interconnects WHERE company_id = v_company AND interconnect_id = p_interconnect_id) THEN
    RETURN json_build_object('success', false, 'error', 'This interconnect is already connected');
  END IF;

  INSERT INTO public.interconnects (company_id, interconnect_id, name, auth_key, role, status, partner_company_id, created_by)
  VALUES (v_company, p_interconnect_id, COALESCE(NULLIF(p_name, ''), v_remote.name), p_auth_key, 'peer', 'connected', v_remote.company_id, auth.uid())
  RETURNING * INTO v_new;

  UPDATE public.interconnects
  SET status = 'connected', partner_company_id = v_company
  WHERE id = v_remote.id;

  RETURN json_build_object('success', true, 'id', v_new.id);
END;
$$;

REVOKE ALL ON FUNCTION public.join_interconnect(text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.join_interconnect(text, text, text) TO authenticated;