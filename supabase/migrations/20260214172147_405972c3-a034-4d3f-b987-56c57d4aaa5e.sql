
-- Create outbound_delivery_items table
CREATE TABLE public.outbound_delivery_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  outbound_delivery_id UUID NOT NULL REFERENCES public.outbound_deliveries(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.outbound_delivery_items ENABLE ROW LEVEL SECURITY;

-- RLS policies (accessible via company through the outbound delivery)
CREATE POLICY "Users can view outbound delivery items via company"
ON public.outbound_delivery_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.outbound_deliveries od
    JOIN public.profiles p ON p.company_id = od.company_id
    WHERE od.id = outbound_delivery_items.outbound_delivery_id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert outbound delivery items via company"
ON public.outbound_delivery_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.outbound_deliveries od
    JOIN public.profiles p ON p.company_id = od.company_id
    WHERE od.id = outbound_delivery_items.outbound_delivery_id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete outbound delivery items via company"
ON public.outbound_delivery_items
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.outbound_deliveries od
    JOIN public.profiles p ON p.company_id = od.company_id
    WHERE od.id = outbound_delivery_items.outbound_delivery_id
    AND p.user_id = auth.uid()
  )
);

-- Add source_location_id to deliveries for internal transfer tracking
ALTER TABLE public.deliveries
ADD COLUMN source_location_id UUID REFERENCES public.locations(id);

-- Index for performance
CREATE INDEX idx_outbound_delivery_items_od_id ON public.outbound_delivery_items(outbound_delivery_id);
CREATE INDEX idx_deliveries_source_location_id ON public.deliveries(source_location_id);
