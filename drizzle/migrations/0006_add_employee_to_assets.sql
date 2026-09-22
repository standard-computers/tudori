ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_assets_employee_id ON public.assets(employee_id);