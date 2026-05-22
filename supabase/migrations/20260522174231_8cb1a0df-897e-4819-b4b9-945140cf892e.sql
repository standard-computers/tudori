CREATE TABLE public.assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  name TEXT NOT NULL,
  asset_tag TEXT,
  description TEXT,
  procurement_value NUMERIC(14,2) NOT NULL DEFAULT 0,
  procurement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  depreciation_rate NUMERIC(6,3) NOT NULL DEFAULT 0,
  useful_life_years INTEGER,
  salvage_value NUMERIC(14,2) NOT NULL DEFAULT 0,
  location_id UUID,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_assets_company_id ON public.assets(company_id);
CREATE INDEX idx_assets_location_id ON public.assets(location_id);

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view assets in their company"
  ON public.assets FOR SELECT
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert assets in their company"
  ON public.assets FOR INSERT
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can update assets in their company"
  ON public.assets FOR UPDATE
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can delete assets in their company"
  ON public.assets FOR DELETE
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE TRIGGER update_assets_updated_at
  BEFORE UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();