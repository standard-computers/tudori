
-- Add delivery_id column to packaging_units to scope PUs to a specific delivery
ALTER TABLE public.packaging_units
ADD COLUMN delivery_id UUID REFERENCES public.deliveries(id) ON DELETE SET NULL;

-- Index for efficient filtering by delivery
CREATE INDEX idx_packaging_units_delivery_id ON public.packaging_units(delivery_id);
