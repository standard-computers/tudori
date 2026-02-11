
-- Create batches table for batch-managed products
CREATE TABLE public.batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  product_id UUID NOT NULL REFERENCES public.products(id),
  batch_number TEXT NOT NULL,
  expiration_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, product_id, batch_number)
);

-- Enable RLS
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view batches in their company"
  ON public.batches FOR SELECT
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can create batches in their company"
  ON public.batches FOR INSERT
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can update batches in their company"
  ON public.batches FOR UPDATE
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can delete batches in their company"
  ON public.batches FOR DELETE
  USING (company_id = public.get_user_company_id(auth.uid()));

-- Add batch_id to inventory
ALTER TABLE public.inventory ADD COLUMN batch_id UUID REFERENCES public.batches(id);

-- Add batch_id to goods_receipt_items
ALTER TABLE public.goods_receipt_items ADD COLUMN batch_id UUID REFERENCES public.batches(id);

-- Timestamp trigger
CREATE TRIGGER update_batches_updated_at
  BEFORE UPDATE ON public.batches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
