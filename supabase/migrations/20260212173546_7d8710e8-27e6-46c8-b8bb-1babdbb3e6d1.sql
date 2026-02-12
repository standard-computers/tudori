ALTER TABLE public.production_orders 
ADD COLUMN assigned_employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL;