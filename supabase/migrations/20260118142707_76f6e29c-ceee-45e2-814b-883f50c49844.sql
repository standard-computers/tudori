-- Create location_users table to track which users can access which locations
CREATE TABLE public.location_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(location_id, user_id)
);

-- Enable RLS
ALTER TABLE public.location_users ENABLE ROW LEVEL SECURITY;

-- RLS policies - users can only see/modify location_users for locations in their company
CREATE POLICY "Users can view location_users for their company's locations"
  ON public.location_users
  FOR SELECT
  USING (
    location_id IN (
      SELECT id FROM public.locations 
      WHERE company_id = public.get_user_company_id(auth.uid())
    )
  );

CREATE POLICY "Users can insert location_users for their company's locations"
  ON public.location_users
  FOR INSERT
  WITH CHECK (
    location_id IN (
      SELECT id FROM public.locations 
      WHERE company_id = public.get_user_company_id(auth.uid())
    )
  );

CREATE POLICY "Users can delete location_users for their company's locations"
  ON public.location_users
  FOR DELETE
  USING (
    location_id IN (
      SELECT id FROM public.locations 
      WHERE company_id = public.get_user_company_id(auth.uid())
    )
  );