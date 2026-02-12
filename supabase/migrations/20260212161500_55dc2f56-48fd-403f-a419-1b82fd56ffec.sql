
ALTER TABLE public.teams ADD COLUMN leader_employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL;
