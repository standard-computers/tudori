
-- Add role column to location_users with default 'member'
ALTER TABLE public.location_users 
ADD COLUMN role text NOT NULL DEFAULT 'member';

-- Add check constraint for valid roles
ALTER TABLE public.location_users 
ADD CONSTRAINT location_users_role_check CHECK (role IN ('member', 'admin'));
