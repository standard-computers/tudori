
-- Create credit memo items table
CREATE TABLE public.credit_memo_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  credit_memo_id UUID NOT NULL REFERENCES public.credit_memos(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create debit memo items table
CREATE TABLE public.debit_memo_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  debit_memo_id UUID NOT NULL REFERENCES public.debit_memos(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.credit_memo_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debit_memo_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for credit_memo_items (company-scoped via credit_memos)
CREATE POLICY "Users can view credit memo items for their company"
ON public.credit_memo_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.credit_memos cm
    JOIN public.profiles p ON p.company_id = cm.company_id
    WHERE cm.id = credit_memo_items.credit_memo_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert credit memo items for their company"
ON public.credit_memo_items FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.credit_memos cm
    JOIN public.profiles p ON p.company_id = cm.company_id
    WHERE cm.id = credit_memo_items.credit_memo_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update credit memo items for their company"
ON public.credit_memo_items FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.credit_memos cm
    JOIN public.profiles p ON p.company_id = cm.company_id
    WHERE cm.id = credit_memo_items.credit_memo_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete credit memo items for their company"
ON public.credit_memo_items FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.credit_memos cm
    JOIN public.profiles p ON p.company_id = cm.company_id
    WHERE cm.id = credit_memo_items.credit_memo_id AND p.user_id = auth.uid()
  )
);

-- RLS policies for debit_memo_items (company-scoped via debit_memos)
CREATE POLICY "Users can view debit memo items for their company"
ON public.debit_memo_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.debit_memos dm
    JOIN public.profiles p ON p.company_id = dm.company_id
    WHERE dm.id = debit_memo_items.debit_memo_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert debit memo items for their company"
ON public.debit_memo_items FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.debit_memos dm
    JOIN public.profiles p ON p.company_id = dm.company_id
    WHERE dm.id = debit_memo_items.debit_memo_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update debit memo items for their company"
ON public.debit_memo_items FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.debit_memos dm
    JOIN public.profiles p ON p.company_id = dm.company_id
    WHERE dm.id = debit_memo_items.debit_memo_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete debit memo items for their company"
ON public.debit_memo_items FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.debit_memos dm
    JOIN public.profiles p ON p.company_id = dm.company_id
    WHERE dm.id = debit_memo_items.debit_memo_id AND p.user_id = auth.uid()
  )
);
