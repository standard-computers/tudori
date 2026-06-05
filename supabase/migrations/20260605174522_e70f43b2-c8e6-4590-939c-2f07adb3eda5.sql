
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS source_vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL;
ALTER TABLE public.routes ALTER COLUMN source_location_id DROP NOT NULL;
ALTER TABLE public.routes DROP CONSTRAINT IF EXISTS routes_company_id_source_location_id_destination_location_i_key;
ALTER TABLE public.routes ADD CONSTRAINT routes_source_one_of CHECK ((source_location_id IS NOT NULL) <> (source_vendor_id IS NOT NULL));
CREATE UNIQUE INDEX IF NOT EXISTS routes_company_src_loc_dest_uniq ON public.routes(company_id, source_location_id, destination_location_id) WHERE source_location_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS routes_company_src_vendor_dest_uniq ON public.routes(company_id, source_vendor_id, destination_location_id) WHERE source_vendor_id IS NOT NULL;
