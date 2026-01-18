-- Create document_id_config table to store document ID format settings per company
CREATE TABLE public.document_id_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL, -- e.g., 'purchase_order', 'requisition', 'delivery', 'vendor', 'customer', 'product', 'location'
  prefix TEXT DEFAULT '', -- optional prefix to prepend (e.g., '1' makes 0001 become 10001)
  num_digits INTEGER NOT NULL DEFAULT 4, -- number of digits to pad to
  starting_number INTEGER NOT NULL DEFAULT 1, -- starting number for the sequence
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, document_type)
);

-- Enable RLS
ALTER TABLE public.document_id_config ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their company's document config"
  ON public.document_id_config
  FOR SELECT
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert their company's document config"
  ON public.document_id_config
  FOR INSERT
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can update their company's document config"
  ON public.document_id_config
  FOR UPDATE
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can delete their company's document config"
  ON public.document_id_config
  FOR DELETE
  USING (company_id = public.get_user_company_id(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_document_id_config_updated_at
  BEFORE UPDATE ON public.document_id_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();