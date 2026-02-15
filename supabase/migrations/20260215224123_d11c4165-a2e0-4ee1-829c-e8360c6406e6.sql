
-- Create time_punch_contests table
CREATE TABLE public.time_punch_contests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  time_punch_id UUID NOT NULL REFERENCES public.time_punches(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  reason TEXT NOT NULL,
  suggested_punch_in TIMESTAMPTZ,
  suggested_punch_out TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.time_punch_contests ENABLE ROW LEVEL SECURITY;

-- Employees can view their own contests
CREATE POLICY "Users can view own contests"
  ON public.time_punch_contests FOR SELECT
  USING (
    employee_id IN (
      SELECT id FROM public.employees WHERE user_id = auth.uid()
    )
  );

-- Managers/admins can view contests in their company
CREATE POLICY "Company members can view contests"
  ON public.time_punch_contests FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

-- Employees can create contests for their own punches
CREATE POLICY "Users can create own contests"
  ON public.time_punch_contests FOR INSERT
  WITH CHECK (
    employee_id IN (
      SELECT id FROM public.employees WHERE user_id = auth.uid()
    )
  );

-- Managers can update contests (review)
CREATE POLICY "Company members can update contests"
  ON public.time_punch_contests FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );
