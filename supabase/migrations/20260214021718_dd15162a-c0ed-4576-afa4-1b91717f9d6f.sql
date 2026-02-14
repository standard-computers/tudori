
-- Create calendar_events table
CREATE TABLE public.calendar_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  created_by UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  all_day BOOLEAN NOT NULL DEFAULT false,
  scope TEXT NOT NULL DEFAULT 'personal' CHECK (scope IN ('personal', 'company')),
  color TEXT DEFAULT '#3b82f6',
  location_id UUID REFERENCES public.locations(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- Users can view their own events and company-wide events
CREATE POLICY "Users can view own and company events"
ON public.calendar_events FOR SELECT
USING (
  company_id = get_user_company_id(auth.uid())
  AND (scope = 'company' OR created_by = auth.uid())
);

-- Users can create events in their company
CREATE POLICY "Users can create events"
ON public.calendar_events FOR INSERT
WITH CHECK (
  company_id = get_user_company_id(auth.uid())
  AND created_by = auth.uid()
);

-- Users can update their own events
CREATE POLICY "Users can update own events"
ON public.calendar_events FOR UPDATE
USING (created_by = auth.uid());

-- Users can delete their own events
CREATE POLICY "Users can delete own events"
ON public.calendar_events FOR DELETE
USING (created_by = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_calendar_events_updated_at
BEFORE UPDATE ON public.calendar_events
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
