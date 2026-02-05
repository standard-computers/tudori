-- Add design_system column to user_preferences table
ALTER TABLE public.user_preferences 
ADD COLUMN IF NOT EXISTS design_system text DEFAULT 'default';