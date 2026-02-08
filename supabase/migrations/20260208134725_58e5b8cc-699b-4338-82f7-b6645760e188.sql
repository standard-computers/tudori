-- Create work_tasks table for sub-tasks within work orders
CREATE TABLE public.work_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  work_order_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL DEFAULT 'pick', -- 'pick', 'drop', 'pack', 'ship'
  sequence INTEGER NOT NULL DEFAULT 1,
  description TEXT,
  product_id UUID REFERENCES public.products(id),
  quantity NUMERIC,
  source_bin_id UUID REFERENCES public.bins(id),
  destination_bin_id UUID REFERENCES public.bins(id),
  pu_id UUID REFERENCES public.packaging_units(id),
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'done'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.work_tasks ENABLE ROW LEVEL SECURITY;

-- RLS policies: access through parent work order's company
CREATE POLICY "Users can view work tasks via work order"
ON public.work_tasks
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    JOIN public.profiles p ON p.company_id = t.company_id
    WHERE t.id = work_tasks.work_order_id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert work tasks"
ON public.work_tasks
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tasks t
    JOIN public.profiles p ON p.company_id = t.company_id
    WHERE t.id = work_tasks.work_order_id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update work tasks"
ON public.work_tasks
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    JOIN public.profiles p ON p.company_id = t.company_id
    WHERE t.id = work_tasks.work_order_id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete work tasks"
ON public.work_tasks
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    JOIN public.profiles p ON p.company_id = t.company_id
    WHERE t.id = work_tasks.work_order_id
    AND p.user_id = auth.uid()
  )
);

-- Index for fast lookups
CREATE INDEX idx_work_tasks_work_order_id ON public.work_tasks(work_order_id);
CREATE INDEX idx_work_tasks_status ON public.work_tasks(status);