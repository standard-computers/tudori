
-- Junction table for positions <-> locations (many-to-many)
CREATE TABLE public.position_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  position_id UUID NOT NULL REFERENCES public.positions(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (position_id, location_id)
);

-- Enable RLS
ALTER TABLE public.position_locations ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can manage position_locations for positions in their company
CREATE POLICY "Users can view position locations for their company"
ON public.position_locations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.positions p
    JOIN public.profiles pr ON pr.company_id = p.company_id
    WHERE p.id = position_locations.position_id
    AND pr.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert position locations for their company"
ON public.position_locations
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.positions p
    JOIN public.profiles pr ON pr.company_id = p.company_id
    WHERE p.id = position_locations.position_id
    AND pr.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete position locations for their company"
ON public.position_locations
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.positions p
    JOIN public.profiles pr ON pr.company_id = p.company_id
    WHERE p.id = position_locations.position_id
    AND pr.user_id = auth.uid()
  )
);
