-- Add created_by column to requisitions table
ALTER TABLE public.requisitions 
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_requisitions_created_by ON public.requisitions(created_by);

-- Update existing requisitions to set created_by from profiles for the company (optional, can be NULL for existing records)