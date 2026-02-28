
CREATE TABLE public.agreement_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agreement_id UUID NOT NULL REFERENCES public.agreements(id) ON DELETE CASCADE,
  rate_id UUID NOT NULL REFERENCES public.tax_rates(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (agreement_id, rate_id)
);

ALTER TABLE public.agreement_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can manage agreement_rates"
  ON public.agreement_rates
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.agreements a
      JOIN public.profiles p ON p.company_id = a.company_id
      WHERE a.id = agreement_rates.agreement_id
        AND p.user_id = auth.uid()
    )
  );
