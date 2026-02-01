-- Add theme column to user_preferences
ALTER TABLE public.user_preferences 
ADD COLUMN IF NOT EXISTS theme text DEFAULT 'light';