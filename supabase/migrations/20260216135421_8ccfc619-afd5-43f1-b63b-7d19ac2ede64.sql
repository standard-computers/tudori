ALTER TABLE public.user_preferences 
ADD COLUMN default_location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL;