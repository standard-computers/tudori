-- Create production_order_consumptions table to track material consumption per step
CREATE TABLE public.production_order_consumptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  production_order_id UUID NOT NULL REFERENCES public.production_orders(id) ON DELETE CASCADE,
  bom_step_id UUID NOT NULL REFERENCES public.bom_steps(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0,
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  bin_id UUID REFERENCES public.bins(id) ON DELETE SET NULL,
  ledger_transaction_id UUID REFERENCES public.ledger_transactions(id) ON DELETE SET NULL,
  consumed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.production_order_consumptions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view consumptions for their company orders"
ON public.production_order_consumptions
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM production_orders po
  WHERE po.id = production_order_consumptions.production_order_id
  AND po.company_id = get_user_company_id(auth.uid())
));

CREATE POLICY "Users can create consumptions for their company orders"
ON public.production_order_consumptions
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM production_orders po
  WHERE po.id = production_order_consumptions.production_order_id
  AND po.company_id = get_user_company_id(auth.uid())
));

CREATE POLICY "Users can delete consumptions for their company orders"
ON public.production_order_consumptions
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM production_orders po
  WHERE po.id = production_order_consumptions.production_order_id
  AND po.company_id = get_user_company_id(auth.uid())
));

-- Add index for faster lookups
CREATE INDEX idx_consumptions_order ON public.production_order_consumptions(production_order_id);
CREATE INDEX idx_consumptions_step ON public.production_order_consumptions(bom_step_id);