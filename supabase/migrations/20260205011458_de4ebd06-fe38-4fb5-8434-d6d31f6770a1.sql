-- Create help_folders table for organizing help documents
CREATE TABLE public.help_folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  parent_folder_id UUID REFERENCES public.help_folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create help_documents table for markdown content
CREATE TABLE public.help_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES public.help_folders(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.help_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.help_documents ENABLE ROW LEVEL SECURITY;

-- RLS policies for help_folders
-- All company users can view
CREATE POLICY "Users can view help folders in their company"
ON public.help_folders FOR SELECT
USING (company_id = get_user_company_id(auth.uid()));

-- Only IT/Admin can manage folders
CREATE POLICY "Admins can create help folders"
ON public.help_folders FOR INSERT
WITH CHECK (
  company_id = get_user_company_id(auth.uid()) 
  AND is_company_admin(auth.uid(), company_id)
);

CREATE POLICY "Admins can update help folders"
ON public.help_folders FOR UPDATE
USING (
  company_id = get_user_company_id(auth.uid()) 
  AND is_company_admin(auth.uid(), company_id)
);

CREATE POLICY "Admins can delete help folders"
ON public.help_folders FOR DELETE
USING (
  company_id = get_user_company_id(auth.uid()) 
  AND is_company_admin(auth.uid(), company_id)
);

-- RLS policies for help_documents
-- All company users can view
CREATE POLICY "Users can view help documents in their company"
ON public.help_documents FOR SELECT
USING (company_id = get_user_company_id(auth.uid()));

-- Only IT/Admin can manage documents
CREATE POLICY "Admins can create help documents"
ON public.help_documents FOR INSERT
WITH CHECK (
  company_id = get_user_company_id(auth.uid()) 
  AND is_company_admin(auth.uid(), company_id)
);

CREATE POLICY "Admins can update help documents"
ON public.help_documents FOR UPDATE
USING (
  company_id = get_user_company_id(auth.uid()) 
  AND is_company_admin(auth.uid(), company_id)
);

CREATE POLICY "Admins can delete help documents"
ON public.help_documents FOR DELETE
USING (
  company_id = get_user_company_id(auth.uid()) 
  AND is_company_admin(auth.uid(), company_id)
);

-- Add triggers for updated_at
CREATE TRIGGER update_help_folders_updated_at
BEFORE UPDATE ON public.help_folders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_help_documents_updated_at
BEFORE UPDATE ON public.help_documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();