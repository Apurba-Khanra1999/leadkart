REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.is_org_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_member_id(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_perm(uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_member_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_perm(uuid, text) TO authenticated;