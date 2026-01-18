-- Add hidden_tiles column to user_preferences
ALTER TABLE public.user_preferences
ADD COLUMN hidden_tiles text[] DEFAULT '{}';
