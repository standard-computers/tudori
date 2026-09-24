ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS pos_count integer NOT NULL DEFAULT 1;

CREATE TABLE public.pos_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  pos_number integer NOT NULL,
  user_id uuid NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, pos_number),
  UNIQUE (location_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pos_assignments TO authenticated;
GRANT ALL ON public.pos_assignments TO service_role;

ALTER TABLE public.pos_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members view POS assignments" ON public.pos_assignments
FOR SELECT TO authenticated USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users assign themselves to POS" ON public.pos_assignments
FOR INSERT TO authenticated WITH CHECK (company_id = public.get_user_company_id(auth.uid()) AND user_id = auth.uid());

CREATE POLICY "Users or admins unassign POS" ON public.pos_assignments
FOR DELETE TO authenticated USING (
  company_id = public.get_user_company_id(auth.uid())
  AND (user_id = auth.uid() OR public.is_company_admin(auth.uid(), company_id)
       OR EXISTS (SELECT 1 FROM public.location_users lu WHERE lu.location_id = pos_assignments.location_id AND lu.user_id = auth.uid() AND lu.role = 'admin'))
);