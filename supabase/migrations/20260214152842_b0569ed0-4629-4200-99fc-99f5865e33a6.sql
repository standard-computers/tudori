-- Add reference to outbound delivery on inbound deliveries
ALTER TABLE public.deliveries
ADD COLUMN outbound_delivery_id UUID REFERENCES public.outbound_deliveries(id);

-- Add index for lookups
CREATE INDEX idx_deliveries_outbound_delivery_id ON public.deliveries(outbound_delivery_id);

-- Add 'partial' status support for outbound deliveries (no constraint change needed, status is text)
-- Add 'partially_fulfilled' as a recognized status in outbound deliveries