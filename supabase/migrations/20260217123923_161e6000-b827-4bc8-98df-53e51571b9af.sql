
-- Table to store which tax rates are assigned to a POS location
CREATE TABLE public.pos_location_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  rate_id UUID NOT NULL REFERENCES public.tax_rates(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(location_id, rate_id)
);

-- Enable RLS
ALTER TABLE public.pos_location_rates ENABLE ROW LEVEL SECURITY;

-- RLS policies - users can manage rates for locations in their company
CREATE POLICY "Users can view POS location rates for their company"
  ON public.pos_location_rates
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.locations l
      JOIN public.profiles p ON p.company_id = l.company_id
      WHERE l.id = pos_location_rates.location_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert POS location rates for their company"
  ON public.pos_location_rates
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.locations l
      JOIN public.profiles p ON p.company_id = l.company_id
      WHERE l.id = pos_location_rates.location_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete POS location rates for their company"
  ON public.pos_location_rates
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.locations l
      JOIN public.profiles p ON p.company_id = l.company_id
      WHERE l.id = pos_location_rates.location_id
        AND p.user_id = auth.uid()
    )
  );
