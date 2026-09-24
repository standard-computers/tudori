ALTER TABLE public.products ADD COLUMN IF NOT EXISTS link TEXT;
COMMENT ON COLUMN public.products.link IS 'Optional external URL related to the product (e.g. supplier page, datasheet).';