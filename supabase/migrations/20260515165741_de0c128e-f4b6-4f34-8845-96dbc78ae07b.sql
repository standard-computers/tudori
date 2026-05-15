ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS truck_id UUID REFERENCES public.trucks(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_deliveries_truck_id ON public.deliveries(truck_id);