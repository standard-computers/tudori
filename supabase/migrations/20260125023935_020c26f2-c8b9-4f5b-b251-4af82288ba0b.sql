-- Add dimension columns to bins table (like products have)
ALTER TABLE public.bins
ADD COLUMN width numeric,
ADD COLUMN width_uom text DEFAULT 'in',
ADD COLUMN length numeric,
ADD COLUMN length_uom text DEFAULT 'in',
ADD COLUMN height numeric,
ADD COLUMN height_uom text DEFAULT 'in',
ADD COLUMN weight_capacity numeric,
ADD COLUMN weight_capacity_uom text DEFAULT 'lb';

-- Create bin_products table for product restrictions
CREATE TABLE public.bin_products (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bin_id uuid NOT NULL REFERENCES public.bins(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  max_quantity integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(bin_id, product_id)
);

-- Enable RLS on bin_products
ALTER TABLE public.bin_products ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for bin_products (same access as bins through areas/locations)
CREATE POLICY "Users can view bin products for their company locations"
  ON public.bin_products FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bins b
      JOIN public.areas a ON b.area_id = a.id
      JOIN public.locations l ON a.location_id = l.id
      JOIN public.profiles p ON l.company_id = p.company_id
      WHERE b.id = bin_products.bin_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert bin products for their company locations"
  ON public.bin_products FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bins b
      JOIN public.areas a ON b.area_id = a.id
      JOIN public.locations l ON a.location_id = l.id
      JOIN public.profiles p ON l.company_id = p.company_id
      WHERE b.id = bin_products.bin_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update bin products for their company locations"
  ON public.bin_products FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.bins b
      JOIN public.areas a ON b.area_id = a.id
      JOIN public.locations l ON a.location_id = l.id
      JOIN public.profiles p ON l.company_id = p.company_id
      WHERE b.id = bin_products.bin_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete bin products for their company locations"
  ON public.bin_products FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.bins b
      JOIN public.areas a ON b.area_id = a.id
      JOIN public.locations l ON a.location_id = l.id
      JOIN public.profiles p ON l.company_id = p.company_id
      WHERE b.id = bin_products.bin_id AND p.user_id = auth.uid()
    )
  );