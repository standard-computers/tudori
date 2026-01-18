-- Add open_apps_in_new_tab preference to user_preferences
ALTER TABLE public.user_preferences
ADD COLUMN open_apps_in_new_tab BOOLEAN DEFAULT false;