-- Create table to track components used at each BOM step
CREATE TABLE public.bom_step_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bom_step_id UUID NOT NULL REFERENCES public.bom_steps(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity NUMERIC NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(bom_step_id, product_id)
);

-- Enable RLS
ALTER TABLE public.bom_step_items ENABLE ROW LEVEL SECURITY;

-- Create policies - access controlled through parent bom_steps -> bill_of_materials -> company
CREATE POLICY "Users can view step items for their company BOMs"
ON public.bom_step_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.bom_steps bs
    JOIN public.bill_of_materials bom ON bom.id = bs.bom_id
    JOIN public.profiles p ON p.company_id = bom.company_id
    WHERE bs.id = bom_step_items.bom_step_id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert step items for their company BOMs"
ON public.bom_step_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.bom_steps bs
    JOIN public.bill_of_materials bom ON bom.id = bs.bom_id
    JOIN public.profiles p ON p.company_id = bom.company_id
    WHERE bs.id = bom_step_items.bom_step_id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update step items for their company BOMs"
ON public.bom_step_items
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.bom_steps bs
    JOIN public.bill_of_materials bom ON bom.id = bs.bom_id
    JOIN public.profiles p ON p.company_id = bom.company_id
    WHERE bs.id = bom_step_items.bom_step_id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete step items for their company BOMs"
ON public.bom_step_items
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.bom_steps bs
    JOIN public.bill_of_materials bom ON bom.id = bs.bom_id
    JOIN public.profiles p ON p.company_id = bom.company_id
    WHERE bs.id = bom_step_items.bom_step_id
    AND p.user_id = auth.uid()
  )
);