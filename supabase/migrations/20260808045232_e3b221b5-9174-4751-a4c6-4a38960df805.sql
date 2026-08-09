-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('owner','admin','sales_manager','sales_executive','accountant');
CREATE TYPE public.member_status AS ENUM ('active','invited','disabled');

-- ============ UTIL ============
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ ORGANIZATIONS ============
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(8),'hex'),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  business_type text,
  logo_url text,
  address text,
  city text,
  state text,
  country text,
  phone text,
  email text,
  tax_number text,
  currency text NOT NULL DEFAULT 'INR',
  currency_symbol text NOT NULL DEFAULT '₹',
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  date_format text NOT NULL DEFAULT 'dd MMM yyyy',
  is_demo boolean NOT NULL DEFAULT false,
  onboarding_step int NOT NULL DEFAULT 0,
  onboarding_completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_org_touch BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  avatar_url text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ TEAMS ============
CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);
CREATE INDEX idx_teams_org ON public.teams(organization_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT ALL ON public.teams TO service_role;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- ============ MEMBERS ============
CREATE TABLE public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  role public.app_role NOT NULL DEFAULT 'sales_executive',
  status public.member_status NOT NULL DEFAULT 'invited',
  invited_at timestamptz NOT NULL DEFAULT now(),
  joined_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, email)
);
CREATE UNIQUE INDEX idx_members_org_user ON public.organization_members(organization_id, user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_members_user ON public.organization_members(user_id);
CREATE INDEX idx_members_org ON public.organization_members(organization_id);
GRANT SELECT, INSERT, UPDATE ON public.organization_members TO authenticated;
GRANT ALL ON public.organization_members TO service_role;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_members_touch BEFORE UPDATE ON public.organization_members FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ PERMISSIONS ============
CREATE TABLE public.permissions (
  key text PRIMARY KEY,
  category text NOT NULL,
  label text NOT NULL,
  description text
);
GRANT SELECT ON public.permissions TO authenticated;
GRANT ALL ON public.permissions TO service_role;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "permissions readable by authenticated" ON public.permissions FOR SELECT TO authenticated USING (true);

CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  permission_key text NOT NULL REFERENCES public.permissions(key) ON DELETE CASCADE,
  UNIQUE (role, permission_key)
);
GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "role_permissions readable by authenticated" ON public.role_permissions FOR SELECT TO authenticated USING (true);

-- ============ TENANT SECURITY FUNCTIONS ============
CREATE OR REPLACE FUNCTION public.is_org_member(_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = _org AND m.user_id = auth.uid() AND m.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.current_member_id(_org uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.id FROM public.organization_members m
  WHERE m.organization_id = _org AND m.user_id = auth.uid() AND m.status = 'active'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.has_perm(_org uuid, _perm text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members m
    JOIN public.role_permissions rp ON rp.role = m.role
    WHERE m.organization_id = _org
      AND m.user_id = auth.uid()
      AND m.status = 'active'
      AND rp.permission_key = _perm
  );
$$;

-- ============ FOUNDATION POLICIES ============
CREATE POLICY "members read own org" ON public.organizations
  FOR SELECT TO authenticated USING (public.is_org_member(id));
CREATE POLICY "authenticated can create org" ON public.organizations
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "org managers update org" ON public.organizations
  FOR UPDATE TO authenticated USING (public.has_perm(id,'org.manage')) WITH CHECK (public.has_perm(id,'org.manage'));

CREATE POLICY "read own profile" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "members read teams" ON public.teams
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY "team managers write teams" ON public.teams
  FOR ALL TO authenticated USING (public.has_perm(organization_id,'team.manage')) WITH CHECK (public.has_perm(organization_id,'team.manage'));

CREATE POLICY "members read members" ON public.organization_members
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_org_member(organization_id));
CREATE POLICY "team managers add members" ON public.organization_members
  FOR INSERT TO authenticated WITH CHECK (public.has_perm(organization_id,'team.manage'));
CREATE POLICY "team managers update members" ON public.organization_members
  FOR UPDATE TO authenticated USING (public.has_perm(organization_id,'team.manage')) WITH CHECK (public.has_perm(organization_id,'team.manage'));

-- ============ PLANS / SUBSCRIPTIONS ============
CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  price_monthly numeric(12,2) NOT NULL DEFAULT 0,
  max_users int,
  max_leads int,
  max_clients int,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans readable" ON public.plans FOR SELECT TO authenticated USING (true);

CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.plans(id),
  status text NOT NULL DEFAULT 'trialing',
  started_at timestamptz NOT NULL DEFAULT now(),
  trial_ends_at timestamptz,
  renews_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read subscription" ON public.subscriptions
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY "billing manage subscription" ON public.subscriptions
  FOR ALL TO authenticated USING (public.has_perm(organization_id,'billing.manage')) WITH CHECK (public.has_perm(organization_id,'billing.manage'));

-- ============ AUDIT LOG ============
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_member_id uuid REFERENCES public.organization_members(id) ON DELETE SET NULL,
  actor_name text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  entity_label text,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_org_created ON public.audit_logs(organization_id, created_at DESC);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit viewers read" ON public.audit_logs
  FOR SELECT TO authenticated USING (public.has_perm(organization_id,'audit.view'));
CREATE POLICY "members append audit" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (public.is_org_member(organization_id));

-- ============ PERMISSION CATALOGUE ============
INSERT INTO public.permissions (key, category, label) VALUES
  ('leads.view.all','Leads','View all leads'),
  ('leads.view.own','Leads','View assigned leads'),
  ('leads.create','Leads','Create leads'),
  ('leads.update','Leads','Update leads'),
  ('leads.delete','Leads','Delete leads'),
  ('leads.assign','Leads','Assign leads'),
  ('leads.convert','Leads','Convert leads'),
  ('clients.view.all','Clients','View all clients'),
  ('clients.view.own','Clients','View assigned clients'),
  ('clients.manage','Clients','Create and edit clients'),
  ('clients.delete','Clients','Delete clients'),
  ('deals.view.all','Deals','View all deals'),
  ('deals.view.own','Deals','View assigned deals'),
  ('deals.manage','Deals','Create and edit deals'),
  ('deals.delete','Deals','Delete deals'),
  ('followups.view.all','Follow-ups','View all follow-ups'),
  ('followups.view.own','Follow-ups','View assigned follow-ups'),
  ('followups.manage','Follow-ups','Create and edit follow-ups'),
  ('activities.create','Activities','Log activities'),
  ('quotations.view','Quotations','View quotations'),
  ('quotations.manage','Quotations','Create and edit quotations'),
  ('invoices.view','Invoices','View invoices'),
  ('invoices.manage','Invoices','Create and edit invoices'),
  ('payments.view','Payments','View payments'),
  ('payments.record','Payments','Record payments'),
  ('reports.view.all','Reports','View organization reports'),
  ('reports.view.team','Reports','View team reports'),
  ('reports.view.own','Reports','View own reports'),
  ('reports.finance','Reports','View financial reports'),
  ('team.view','Team','View team'),
  ('team.manage','Team','Manage team members'),
  ('automations.manage','Automations','Manage automations'),
  ('settings.manage','Settings','Manage operational settings'),
  ('org.manage','Organization','Manage organization'),
  ('billing.manage','Organization','Manage billing'),
  ('audit.view','Organization','View audit log'),
  ('data.import','Data','Import data'),
  ('data.export','Data','Export data');

INSERT INTO public.role_permissions (role, permission_key)
SELECT 'owner'::public.app_role, key FROM public.permissions;

INSERT INTO public.role_permissions (role, permission_key)
SELECT 'admin'::public.app_role, key FROM public.permissions
WHERE key NOT IN ('billing.manage');

INSERT INTO public.role_permissions (role, permission_key) VALUES
  ('sales_manager','leads.view.all'),('sales_manager','leads.view.own'),('sales_manager','leads.create'),
  ('sales_manager','leads.update'),('sales_manager','leads.assign'),('sales_manager','leads.convert'),
  ('sales_manager','clients.view.all'),('sales_manager','clients.manage'),
  ('sales_manager','deals.view.all'),('sales_manager','deals.manage'),
  ('sales_manager','followups.view.all'),('sales_manager','followups.manage'),
  ('sales_manager','activities.create'),('sales_manager','quotations.view'),('sales_manager','quotations.manage'),
  ('sales_manager','invoices.view'),('sales_manager','payments.view'),
  ('sales_manager','reports.view.team'),('sales_manager','reports.view.own'),
  ('sales_manager','team.view'),('sales_manager','data.export');

INSERT INTO public.role_permissions (role, permission_key) VALUES
  ('sales_executive','leads.view.own'),('sales_executive','leads.create'),('sales_executive','leads.update'),
  ('sales_executive','clients.view.own'),('sales_executive','deals.view.own'),('sales_executive','deals.manage'),
  ('sales_executive','followups.view.own'),('sales_executive','followups.manage'),
  ('sales_executive','activities.create'),('sales_executive','quotations.view'),
  ('sales_executive','invoices.view'),('sales_executive','reports.view.own');

INSERT INTO public.role_permissions (role, permission_key) VALUES
  ('accountant','clients.view.all'),('accountant','deals.view.all'),
  ('accountant','quotations.view'),('accountant','quotations.manage'),
  ('accountant','invoices.view'),('accountant','invoices.manage'),
  ('accountant','payments.view'),('accountant','payments.record'),
  ('accountant','followups.view.all'),('accountant','followups.manage'),
  ('accountant','activities.create'),('accountant','reports.finance'),('accountant','data.export');

INSERT INTO public.plans (code,name,description,price_monthly,max_users,max_leads,max_clients,features,sort_order) VALUES
  ('free','Free','Get started with the basics',0,2,100,50,'{"pipeline":true,"reports":false,"automations":false,"quotations":false,"invoices":false}',1),
  ('starter','Starter','For small sales teams',1499,5,1000,NULL,'{"pipeline":true,"reports":true,"automations":false,"quotations":true,"invoices":true}',2),
  ('professional','Professional','For growing sales organizations',3999,15,NULL,NULL,'{"pipeline":true,"reports":true,"automations":true,"quotations":true,"invoices":true,"advanced_permissions":true}',3),
  ('enterprise','Enterprise','Custom limits and priority support',0,NULL,NULL,NULL,'{"pipeline":true,"reports":true,"automations":true,"quotations":true,"invoices":true,"advanced_permissions":true,"priority_support":true}',4);

-- ============ NEW USER HANDLING ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name text;
  v_demo_org uuid;
BEGIN
  v_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1));
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, v_name, NEW.email)
  ON CONFLICT (id) DO NOTHING;

  SELECT id INTO v_demo_org FROM public.organizations WHERE is_demo = true ORDER BY created_at LIMIT 1;
  IF v_demo_org IS NOT NULL THEN
    INSERT INTO public.organization_members (organization_id, user_id, full_name, email, role, status, joined_at)
    VALUES (v_demo_org, NEW.id, v_name, NEW.email, 'owner', 'active', now())
    ON CONFLICT (organization_id, email) DO UPDATE
      SET user_id = EXCLUDED.user_id, status = 'active', joined_at = now();
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();