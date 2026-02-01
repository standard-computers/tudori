-- Add column to track completed step IDs for production orders
ALTER TABLE public.production_orders 
ADD COLUMN completed_step_ids text[] DEFAULT '{}'::text[];