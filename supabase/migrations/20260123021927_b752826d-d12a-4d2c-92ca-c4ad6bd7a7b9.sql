-- Create employees table
CREATE TABLE public.employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  job_title TEXT,
  department TEXT,
  hire_date DATE,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, employee_id)
);

-- Create teams table
CREATE TABLE public.teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, team_id)
);

-- Create team_members junction table
CREATE TABLE public.team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(team_id, employee_id)
);

-- Enable RLS
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- RLS policies for employees
CREATE POLICY "Users can view employees in their company"
ON public.employees FOR SELECT
USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert employees in their company"
ON public.employees FOR INSERT
WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update employees in their company"
ON public.employees FOR UPDATE
USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete employees in their company"
ON public.employees FOR DELETE
USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));

-- RLS policies for teams
CREATE POLICY "Users can view teams in their company"
ON public.teams FOR SELECT
USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert teams in their company"
ON public.teams FOR INSERT
WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update teams in their company"
ON public.teams FOR UPDATE
USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete teams in their company"
ON public.teams FOR DELETE
USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));

-- RLS policies for team_members (based on team's company)
CREATE POLICY "Users can view team members in their company"
ON public.team_members FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.teams t 
  WHERE t.id = team_members.team_id 
  AND t.company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid())
));

CREATE POLICY "Users can insert team members in their company"
ON public.team_members FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.teams t 
  WHERE t.id = team_members.team_id 
  AND t.company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid())
));

CREATE POLICY "Users can update team members in their company"
ON public.team_members FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.teams t 
  WHERE t.id = team_members.team_id 
  AND t.company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid())
));

CREATE POLICY "Users can delete team members in their company"
ON public.team_members FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.teams t 
  WHERE t.id = team_members.team_id 
  AND t.company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid())
));

-- Add updated_at triggers
CREATE TRIGGER update_employees_updated_at
BEFORE UPDATE ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_teams_updated_at
BEFORE UPDATE ON public.teams
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create functions to get next IDs
CREATE OR REPLACE FUNCTION public.get_next_employee_id(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  next_num INTEGER;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid() AND company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'Access denied: User does not belong to this company';
  END IF;

  SELECT COALESCE(MAX(CAST(employee_id AS INTEGER)), 0) + 1
  INTO next_num
  FROM public.employees
  WHERE company_id = p_company_id;
  
  RETURN LPAD(next_num::TEXT, 4, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.get_next_team_id(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  next_num INTEGER;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid() AND company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'Access denied: User does not belong to this company';
  END IF;

  SELECT COALESCE(MAX(CAST(team_id AS INTEGER)), 0) + 1
  INTO next_num
  FROM public.teams
  WHERE company_id = p_company_id;
  
  RETURN LPAD(next_num::TEXT, 4, '0');
END;
$$;