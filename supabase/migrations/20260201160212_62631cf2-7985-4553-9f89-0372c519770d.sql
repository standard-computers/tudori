-- Add source_location_id to assignments table to allow internal locations as sources
ALTER TABLE public.assignments 
  ALTER COLUMN vendor_id DROP NOT NULL,
  ADD COLUMN source_location_id uuid REFERENCES public.locations(id);

-- Add check constraint to ensure either vendor_id or source_location_id is set (but not both)
ALTER TABLE public.assignments 
  ADD CONSTRAINT assignments_source_check 
  CHECK (
    (vendor_id IS NOT NULL AND source_location_id IS NULL) OR 
    (vendor_id IS NULL AND source_location_id IS NOT NULL)
  );

-- Create index for the new column
CREATE INDEX idx_assignments_source_location_id ON public.assignments(source_location_id);