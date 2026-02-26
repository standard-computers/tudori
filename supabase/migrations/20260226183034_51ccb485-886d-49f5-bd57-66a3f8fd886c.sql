ALTER TABLE public.agreement_items
  ADD COLUMN cadence text DEFAULT NULL,
  ADD COLUMN cadence_day text DEFAULT NULL;