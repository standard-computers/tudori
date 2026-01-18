-- Create inventory table to track product quantities at locations/bins
CREATE TABLE public.inventory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  bin_id UUID REFERENCES public.bins(id) ON DELETE SET NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0,
  min_quantity INTEGER DEFAULT NULL,
  max_quantity INTEGER DEFAULT NULL,
  last_counted_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(location_id, bin_id, product_id)
);

-- Enable RLS
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view inventory for their company locations"
  ON public.inventory FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.locations l
      JOIN public.profiles p ON p.company_id = l.company_id
      WHERE l.id = inventory.location_id
      AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert inventory for their company locations"
  ON public.inventory FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.locations l
      JOIN public.profiles p ON p.company_id = l.company_id
      WHERE l.id = inventory.location_id
      AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update inventory for their company locations"
  ON public.inventory FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.locations l
      JOIN public.profiles p ON p.company_id = l.company_id
      WHERE l.id = inventory.location_id
      AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete inventory for their company locations"
  ON public.inventory FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.locations l
      JOIN public.profiles p ON p.company_id = l.company_id
      WHERE l.id = inventory.location_id
      AND p.user_id = auth.uid()
    )
  );

-- Create trigger for updated_at
CREATE TRIGGER update_inventory_updated_at
  BEFORE UPDATE ON public.inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();