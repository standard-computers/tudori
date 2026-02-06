-- Add source_location_id column to requisitions for internal transfer sourcing
ALTER TABLE public.requisitions 
ADD COLUMN source_location_id UUID REFERENCES public.locations(id);

-- Add index for lookups
CREATE INDEX idx_requisitions_source_location ON public.requisitions(source_location_id) WHERE source_location_id IS NOT NULL;