-- =====================================================================
-- Migration: Fix member deletion RLS, fix handle_new_user auto-org creation,
-- enforce multi-tenant owner isolation
-- =====================================================================

-- 1. GRANT DELETE on organization_members for authenticated users
--    (previously only SELECT, INSERT, UPDATE were granted)
GRANT DELETE ON public.organization_members TO authenticated;

-- 2. Add RLS DELETE policy: only owners/admins (team.manage) in the same org
--    can delete members, and you cannot delete yourself
DROP POLICY IF EXISTS "team managers delete members" ON public.organization_members;
CREATE POLICY "team managers delete members" ON public.organization_members
  FOR DELETE TO authenticated
  USING (
    public.has_perm(organization_id, 'team.manage')
    AND id <> public.current_member_id(organization_id)
  );

-- 3. Allow a user to self-join (update their own invited record to active)
--    This is needed for the workspace hook that sets user_id + status on invited members
DROP POLICY IF EXISTS "member self-activate on invite claim" ON public.organization_members;
CREATE POLICY "member self-activate on invite claim" ON public.organization_members
  FOR UPDATE TO authenticated
  USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()))
  WITH CHECK (true);

-- 4. Fix handle_new_user() trigger:
--    Instead of joining the demo org, auto-create a brand-new Organization for every
--    independent signup and set them as owner. Invited members are handled by the
--    workspace hook (use-workspace.ts) when they first log in.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name       text;
  v_invited_id uuid;
  v_new_org_id uuid;
BEGIN
  -- 1. Upsert profile row
  v_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, v_name, NEW.email)
  ON CONFLICT (id) DO NOTHING;

  -- 2. Check if there is an existing invited member record for this email
  SELECT id INTO v_invited_id
  FROM public.organization_members
  WHERE email = lower(NEW.email)
    AND status IN ('invited', 'active')
  LIMIT 1;

  IF v_invited_id IS NOT NULL THEN
    -- Claim the invited record: set user_id + activate
    UPDATE public.organization_members
    SET user_id  = NEW.id,
        status   = 'active',
        joined_at = COALESCE(joined_at, now())
    WHERE id = v_invited_id;
    RETURN NEW;
  END IF;

  -- 3. No existing membership → create a fresh isolated Organization for this user
  --    They become the sole Owner of their own workspace.
  INSERT INTO public.organizations (name, slug, currency_symbol, is_demo)
  VALUES (
    v_name || '''s Workspace',
    'org-' || extract(epoch from now())::bigint || '-' || substr(md5(NEW.id::text), 1, 6),
    '₹',
    false
  )
  RETURNING id INTO v_new_org_id;

  -- Seed org settings, lead sources, statuses, deal stages via existing trigger
  -- (seed_new_organization fires on INSERT to organizations)

  -- Insert owner member record
  INSERT INTO public.organization_members (organization_id, user_id, full_name, email, role, status, joined_at)
  VALUES (v_new_org_id, NEW.id, v_name, lower(NEW.email), 'owner', 'active', now())
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;
