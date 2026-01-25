-- Add source_location_id to purchase_orders for tracking internal transfers
-- When a PO is placed from one internal location to another, this stores the source/vendor location
ALTER TABLE public.purchase_orders 
ADD COLUMN source_location_id uuid REFERENCES public.locations(id);

-- Add is_fulfilled flag to deliveries to track if source location has shipped
-- This allows blocking reception until the source location fulfills
ALTER TABLE public.deliveries 
ADD COLUMN is_fulfilled boolean NOT NULL DEFAULT false;

-- Create index for efficient querying of internal transfer orders by source location
CREATE INDEX idx_purchase_orders_source_location ON public.purchase_orders(source_location_id) WHERE source_location_id IS NOT NULL;

-- Comment for clarity
COMMENT ON COLUMN public.purchase_orders.source_location_id IS 'Source location for internal transfers. When set, this PO is an internal transfer from this location.';
COMMENT ON COLUMN public.deliveries.is_fulfilled IS 'Whether the source location has fulfilled/shipped this delivery. For internal transfers, must be true before destination can receive.';