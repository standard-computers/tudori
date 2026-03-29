-- Drop the temp_password column from invitations table (no data exists, column is unused)
ALTER TABLE public.invitations DROP COLUMN IF EXISTS temp_password;