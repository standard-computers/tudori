CREATE TABLE public.platform_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_admins TO authenticated;
GRANT ALL ON public.platform_admins TO service_role;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can see own platform admin row" ON public.platform_admins FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = _user_id)
$$;

CREATE TABLE public.platform_doc_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_folder_id uuid REFERENCES public.platform_doc_folders(id) ON DELETE RESTRICT,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_doc_folders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_doc_folders TO authenticated;
GRANT ALL ON public.platform_doc_folders TO service_role;
ALTER TABLE public.platform_doc_folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can read platform doc folders" ON public.platform_doc_folders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Platform admins manage folders insert" ON public.platform_doc_folders FOR INSERT TO authenticated WITH CHECK (public.is_platform_admin(auth.uid()));
CREATE POLICY "Platform admins manage folders update" ON public.platform_doc_folders FOR UPDATE TO authenticated USING (public.is_platform_admin(auth.uid()));
CREATE POLICY "Platform admins manage folders delete" ON public.platform_doc_folders FOR DELETE TO authenticated USING (public.is_platform_admin(auth.uid()));

CREATE TABLE public.platform_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id uuid REFERENCES public.platform_doc_folders(id) ON DELETE SET NULL,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_documents TO authenticated;
GRANT ALL ON public.platform_documents TO service_role;
ALTER TABLE public.platform_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can read platform documents" ON public.platform_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Platform admins insert documents" ON public.platform_documents FOR INSERT TO authenticated WITH CHECK (public.is_platform_admin(auth.uid()));
CREATE POLICY "Platform admins update documents" ON public.platform_documents FOR UPDATE TO authenticated USING (public.is_platform_admin(auth.uid()));
CREATE POLICY "Platform admins delete documents" ON public.platform_documents FOR DELETE TO authenticated USING (public.is_platform_admin(auth.uid()));

CREATE TRIGGER platform_doc_folders_updated_at BEFORE UPDATE ON public.platform_doc_folders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER platform_documents_updated_at BEFORE UPDATE ON public.platform_documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();