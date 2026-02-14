
-- Time off requests table
CREATE TABLE public.time_off_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL DEFAULT 'vacation',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  hours NUMERIC,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.time_off_requests ENABLE ROW LEVEL SECURITY;

-- Employees can view their own requests
CREATE POLICY "Employees can view own time off requests"
ON public.time_off_requests
FOR SELECT
USING (
  employee_id IN (
    SELECT id FROM public.employees WHERE user_id = auth.uid()
  )
  OR
  public.get_user_company_id(auth.uid()) = company_id
);

-- Employees can create their own requests
CREATE POLICY "Employees can create own time off requests"
ON public.time_off_requests
FOR INSERT
WITH CHECK (
  employee_id IN (
    SELECT id FROM public.employees WHERE user_id = auth.uid()
  )
  AND public.get_user_company_id(auth.uid()) = company_id
);

-- Employees can update their own pending requests, admins can update any
CREATE POLICY "Update own pending or admin update any"
ON public.time_off_requests
FOR UPDATE
USING (
  (
    employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
    AND status = 'pending'
  )
  OR
  public.is_company_admin(auth.uid(), company_id)
);

-- Employees can delete their own pending requests
CREATE POLICY "Delete own pending requests"
ON public.time_off_requests
FOR DELETE
USING (
  employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
  AND status = 'pending'
);

-- Trigger for updated_at
CREATE TRIGGER update_time_off_requests_updated_at
  BEFORE UPDATE ON public.time_off_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
