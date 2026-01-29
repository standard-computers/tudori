-- Add created_by column to purchase_orders table
ALTER TABLE public.purchase_orders
ADD COLUMN created_by UUID REFERENCES auth.users(id);

-- Create index for performance
CREATE INDEX idx_purchase_orders_created_by ON public.purchase_orders(created_by);