-- Add purchase_order_id and to_location_id to outbound_deliveries for internal transfer support
ALTER TABLE public.outbound_deliveries 
ADD COLUMN purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
ADD COLUMN to_location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL;

-- Create index for purchase_order_id lookups
CREATE INDEX idx_outbound_deliveries_purchase_order_id ON public.outbound_deliveries(purchase_order_id);
