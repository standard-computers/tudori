-- Grant necessary permissions on companies table to authenticated users
GRANT SELECT, INSERT, UPDATE ON public.companies TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.companies TO anon;