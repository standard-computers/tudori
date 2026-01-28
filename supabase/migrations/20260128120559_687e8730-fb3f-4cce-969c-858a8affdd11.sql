-- Create bom_steps table for production steps
CREATE TABLE public.bom_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bom_id UUID NOT NULL REFERENCES public.bill_of_materials(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL DEFAULT 1,
  name TEXT NOT NULL,
  description TEXT,
  location_id UUID REFERENCES public.locations(id),
  bin_id UUID REFERENCES public.bins(id),
  estimated_duration_minutes INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique constraint on bom_id + step_number
CREATE UNIQUE INDEX bom_steps_bom_step_unique ON public.bom_steps(bom_id, step_number);

-- Enable RLS
ALTER TABLE public.bom_steps ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view BOM steps in their company"
  ON public.bom_steps
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bill_of_materials bom
      WHERE bom.id = bom_steps.bom_id
      AND bom.company_id = get_user_company_id(auth.uid())
    )
  );

CREATE POLICY "Users can create BOM steps in their company"
  ON public.bom_steps
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bill_of_materials bom
      WHERE bom.id = bom_steps.bom_id
      AND bom.company_id = get_user_company_id(auth.uid())
    )
  );

CREATE POLICY "Users can update BOM steps in their company"
  ON public.bom_steps
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM bill_of_materials bom
      WHERE bom.id = bom_steps.bom_id
      AND bom.company_id = get_user_company_id(auth.uid())
    )
  );

CREATE POLICY "Users can delete BOM steps in their company"
  ON public.bom_steps
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM bill_of_materials bom
      WHERE bom.id = bom_steps.bom_id
      AND bom.company_id = get_user_company_id(auth.uid())
    )
  );