
-- Create developer_keys table for API keys, auth config, and webhooks
CREATE TABLE public.developer_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  key_type TEXT NOT NULL CHECK (key_type IN ('api_key', 'oauth', 'webhook')),
  name TEXT NOT NULL,
  key_value TEXT, -- API key or client ID
  secret_value TEXT, -- Secret key or client secret
  redirect_uri TEXT,
  webhook_url TEXT,
  webhook_events TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.developer_keys ENABLE ROW LEVEL SECURITY;

-- Policies: company-scoped access for authenticated users
CREATE POLICY "Users can view their company developer keys"
  ON public.developer_keys FOR SELECT
  USING (company_id = (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins can insert developer keys"
  ON public.developer_keys FOR INSERT
  WITH CHECK (
    company_id = (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
    AND public.is_company_admin(auth.uid(), company_id)
  );

CREATE POLICY "Admins can update developer keys"
  ON public.developer_keys FOR UPDATE
  USING (
    company_id = (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
    AND public.is_company_admin(auth.uid(), company_id)
  );

CREATE POLICY "Admins can delete developer keys"
  ON public.developer_keys FOR DELETE
  USING (
    company_id = (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
    AND public.is_company_admin(auth.uid(), company_id)
  );

-- Trigger for updated_at
CREATE TRIGGER update_developer_keys_updated_at
  BEFORE UPDATE ON public.developer_keys
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
