-- Restore EXECUTE on RLS helper functions to `authenticated`.
-- These are called from RLS policies (profiles, user_roles, companies, employees, etc.)
-- and Postgres checks EXECUTE privilege even for SECURITY DEFINER functions when
-- invoked inside a policy expression evaluated as the `authenticated` role.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_company_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_company_it(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_company_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.company_has_roles(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_conversation_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_auth_email(uuid) TO authenticated;