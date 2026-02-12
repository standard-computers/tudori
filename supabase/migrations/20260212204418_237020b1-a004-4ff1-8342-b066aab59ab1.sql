-- Add temp_password column to invitations table
ALTER TABLE public.invitations ADD COLUMN temp_password text;

-- Allow admins to read temp_password (existing RLS policies should already handle access)
