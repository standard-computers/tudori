-- Create areas table for warehouse/DC locations
CREATE TABLE public.areas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  area_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(location_id, area_id)
);

-- Create bins table for areas
CREATE TABLE public.bins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  area_id UUID NOT NULL REFERENCES public.areas(id) ON DELETE CASCADE,
  bin_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  capacity TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(area_id, bin_id)
);

-- Enable RLS
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bins ENABLE ROW LEVEL SECURITY;

-- RLS policies for areas (through location's company)
CREATE POLICY "Users can view areas in their company locations"
ON public.areas FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.locations l
    JOIN public.profiles p ON p.company_id = l.company_id
    WHERE l.id = areas.location_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create areas in their company locations"
ON public.areas FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.locations l
    JOIN public.profiles p ON p.company_id = l.company_id
    WHERE l.id = areas.location_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update areas in their company locations"
ON public.areas FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.locations l
    JOIN public.profiles p ON p.company_id = l.company_id
    WHERE l.id = areas.location_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete areas in their company locations"
ON public.areas FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.locations l
    JOIN public.profiles p ON p.company_id = l.company_id
    WHERE l.id = areas.location_id AND p.user_id = auth.uid()
  )
);

-- RLS policies for bins (through area's location's company)
CREATE POLICY "Users can view bins in their company locations"
ON public.bins FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.areas a
    JOIN public.locations l ON l.id = a.location_id
    JOIN public.profiles p ON p.company_id = l.company_id
    WHERE a.id = bins.area_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create bins in their company locations"
ON public.bins FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.areas a
    JOIN public.locations l ON l.id = a.location_id
    JOIN public.profiles p ON p.company_id = l.company_id
    WHERE a.id = bins.area_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update bins in their company locations"
ON public.bins FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.areas a
    JOIN public.locations l ON l.id = a.location_id
    JOIN public.profiles p ON p.company_id = l.company_id
    WHERE a.id = bins.area_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete bins in their company locations"
ON public.bins FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.areas a
    JOIN public.locations l ON l.id = a.location_id
    JOIN public.profiles p ON p.company_id = l.company_id
    WHERE a.id = bins.area_id AND p.user_id = auth.uid()
  )
);

-- Add triggers for updated_at
CREATE TRIGGER update_areas_updated_at
BEFORE UPDATE ON public.areas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bins_updated_at
BEFORE UPDATE ON public.bins
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();