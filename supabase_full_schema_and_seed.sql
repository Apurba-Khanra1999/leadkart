-- LEADKART COMPLETE DATABASE SCHEMA AND INITIAL SEED
-- Project ID: mmucchbxfbjnlkwceohk

-- ==========================================
-- Migration: 20260808045232_e3b221b5-9174-4751-a4c6-4a38960df805.sql
-- ==========================================

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

-- ==========================================
-- Migration: 20260808045255_0ddeeeac-6701-4b5c-90c1-4d2f09eaf0b0.sql
-- ==========================================

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.is_org_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_member_id(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_perm(uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_member_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_perm(uuid, text) TO authenticated;

-- ==========================================
-- Migration: 20260808045947_ec31788a-0c32-4f10-9b28-2529609dd679.sql
-- ==========================================

-- ===== ENUMS =====
CREATE TYPE public.lead_priority AS ENUM ('low','medium','high','urgent');
CREATE TYPE public.client_status AS ENUM ('active','inactive','vip','at_risk','lost');
CREATE TYPE public.followup_type AS ENUM ('call','whatsapp','email','meeting','proposal','payment_reminder','demo','other');
CREATE TYPE public.followup_status AS ENUM ('pending','completed','rescheduled','cancelled');
CREATE TYPE public.deal_status AS ENUM ('open','won','lost');
CREATE TYPE public.quotation_status AS ENUM ('draft','sent','viewed','accepted','rejected','expired');
CREATE TYPE public.invoice_status AS ENUM ('draft','sent','partially_paid','paid','overdue','cancelled');
CREATE TYPE public.payment_method AS ENUM ('cash','bank_transfer','upi','card','cheque','other');
CREATE TYPE public.payment_status AS ENUM ('recorded','reversed');

-- ===== CONFIGURABLE LISTS =====
CREATE TABLE public.lead_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL, sort_order int NOT NULL DEFAULT 0, is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);
CREATE TABLE public.lead_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL, color text NOT NULL DEFAULT 'slate', sort_order int NOT NULL DEFAULT 0,
  is_won boolean NOT NULL DEFAULT false, is_lost boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);
CREATE TABLE public.deal_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL, sort_order int NOT NULL DEFAULT 0, default_probability int NOT NULL DEFAULT 10,
  is_won boolean NOT NULL DEFAULT false, is_lost boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);
CREATE TABLE public.tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL, color text NOT NULL DEFAULT 'slate',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

-- ===== CLIENTS =====
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  public_id text NOT NULL DEFAULT encode(gen_random_bytes(8),'hex'),
  client_code text NOT NULL,
  company_name text NOT NULL,
  contact_person text, phone text, email text, website text, tax_number text,
  billing_address text, shipping_address text, industry text,
  account_manager_id uuid REFERENCES public.organization_members(id) ON DELETE SET NULL,
  status public.client_status NOT NULL DEFAULT 'active',
  notes text,
  created_by uuid REFERENCES public.organization_members(id) ON DELETE SET NULL,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, client_code)
);
CREATE INDEX idx_clients_org ON public.clients(organization_id);
CREATE INDEX idx_clients_mgr ON public.clients(account_manager_id);

CREATE TABLE public.client_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL, job_title text, phone text, email text, is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_client_contacts_client ON public.client_contacts(client_id);

-- ===== LEADS =====
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  public_id text NOT NULL DEFAULT encode(gen_random_bytes(8),'hex'),
  lead_number text NOT NULL,
  first_name text NOT NULL, last_name text,
  company text, job_title text,
  phone text, alt_phone text, email text, website text,
  address text, city text, state text, country text DEFAULT 'India',
  source_id uuid REFERENCES public.lead_sources(id) ON DELETE SET NULL,
  status_id uuid REFERENCES public.lead_statuses(id) ON DELETE SET NULL,
  industry text,
  priority public.lead_priority NOT NULL DEFAULT 'medium',
  estimated_value numeric(14,2) NOT NULL DEFAULT 0,
  assigned_member_id uuid REFERENCES public.organization_members(id) ON DELETE SET NULL,
  notes text,
  created_by uuid REFERENCES public.organization_members(id) ON DELETE SET NULL,
  last_contacted_at timestamptz,
  next_followup_at timestamptz,
  converted_at timestamptz,
  converted_client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  converted_deal_id uuid,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, lead_number)
);
CREATE INDEX idx_leads_org_status ON public.leads(organization_id, status_id);
CREATE INDEX idx_leads_assigned ON public.leads(assigned_member_id);
CREATE INDEX idx_leads_created ON public.leads(organization_id, created_at DESC);
CREATE INDEX idx_leads_next_fu ON public.leads(organization_id, next_followup_at);

CREATE TABLE public.lead_tags (
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  PRIMARY KEY (lead_id, tag_id)
);

-- ===== DEALS =====
CREATE TABLE public.deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  public_id text NOT NULL DEFAULT encode(gen_random_bytes(8),'hex'),
  deal_number text NOT NULL,
  name text NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  assigned_member_id uuid REFERENCES public.organization_members(id) ON DELETE SET NULL,
  stage_id uuid REFERENCES public.deal_stages(id) ON DELETE SET NULL,
  value numeric(14,2) NOT NULL DEFAULT 0,
  probability int NOT NULL DEFAULT 10 CHECK (probability BETWEEN 0 AND 100),
  weighted_value numeric(14,2) NOT NULL DEFAULT 0,
  expected_close_date date,
  closed_at timestamptz,
  source text, description text, notes text,
  status public.deal_status NOT NULL DEFAULT 'open',
  priority public.lead_priority NOT NULL DEFAULT 'medium',
  created_by uuid REFERENCES public.organization_members(id) ON DELETE SET NULL,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, deal_number)
);
CREATE INDEX idx_deals_org_stage ON public.deals(organization_id, stage_id);
CREATE INDEX idx_deals_client ON public.deals(client_id);
CREATE INDEX idx_deals_assigned ON public.deals(assigned_member_id);
ALTER TABLE public.leads ADD CONSTRAINT leads_converted_deal_fk
  FOREIGN KEY (converted_deal_id) REFERENCES public.deals(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.deal_weighted()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.weighted_value := ROUND(COALESCE(NEW.value,0) * COALESCE(NEW.probability,0) / 100.0, 2);
  NEW.updated_at := now();
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_deal_weighted BEFORE INSERT OR UPDATE ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.deal_weighted();

-- ===== FOLLOW-UPS =====
CREATE TABLE public.follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  deal_id uuid REFERENCES public.deals(id) ON DELETE CASCADE,
  invoice_id uuid,
  assigned_member_id uuid REFERENCES public.organization_members(id) ON DELETE SET NULL,
  type public.followup_type NOT NULL DEFAULT 'call',
  due_at timestamptz NOT NULL,
  reminder_minutes int DEFAULT 30,
  priority public.lead_priority NOT NULL DEFAULT 'medium',
  status public.followup_status NOT NULL DEFAULT 'pending',
  subject text,
  notes text,
  outcome text,
  completed_at timestamptz,
  rescheduled_from timestamptz,
  created_by uuid REFERENCES public.organization_members(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_fu_org_due ON public.follow_ups(organization_id, due_at);
CREATE INDEX idx_fu_assigned ON public.follow_ups(assigned_member_id, status);
CREATE INDEX idx_fu_lead ON public.follow_ups(lead_id);

-- ===== ACTIVITIES =====
CREATE TABLE public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  description text,
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  deal_id uuid REFERENCES public.deals(id) ON DELETE CASCADE,
  follow_up_id uuid REFERENCES public.follow_ups(id) ON DELETE SET NULL,
  invoice_id uuid,
  actor_member_id uuid REFERENCES public.organization_members(id) ON DELETE SET NULL,
  actor_name text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_act_org_time ON public.activities(organization_id, occurred_at DESC);
CREATE INDEX idx_act_lead ON public.activities(lead_id, occurred_at DESC);
CREATE INDEX idx_act_client ON public.activities(client_id, occurred_at DESC);
CREATE INDEX idx_act_deal ON public.activities(deal_id, occurred_at DESC);

-- ===== QUOTATIONS =====
CREATE TABLE public.quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  public_id text NOT NULL DEFAULT encode(gen_random_bytes(8),'hex'),
  quotation_number text NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  expiry_date date,
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  discount_total numeric(14,2) NOT NULL DEFAULT 0,
  tax_total numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  status public.quotation_status NOT NULL DEFAULT 'draft',
  notes text, terms text,
  created_by uuid REFERENCES public.organization_members(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, quotation_number)
);
CREATE TABLE public.quotation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  quotation_id uuid NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric(12,2) NOT NULL DEFAULT 1,
  unit_price numeric(14,2) NOT NULL DEFAULT 0,
  discount_percent numeric(5,2) NOT NULL DEFAULT 0,
  tax_percent numeric(5,2) NOT NULL DEFAULT 0,
  line_total numeric(14,2) NOT NULL DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0
);

-- ===== INVOICES =====
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  public_id text NOT NULL DEFAULT encode(gen_random_bytes(8),'hex'),
  invoice_number text NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  quotation_id uuid REFERENCES public.quotations(id) ON DELETE SET NULL,
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL DEFAULT (CURRENT_DATE + 15),
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  discount_total numeric(14,2) NOT NULL DEFAULT 0,
  tax_total numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  paid_amount numeric(14,2) NOT NULL DEFAULT 0,
  outstanding_amount numeric(14,2) NOT NULL DEFAULT 0,
  status public.invoice_status NOT NULL DEFAULT 'draft',
  notes text, terms text,
  created_by uuid REFERENCES public.organization_members(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, invoice_number),
  CONSTRAINT invoice_paid_not_negative CHECK (paid_amount >= 0),
  CONSTRAINT invoice_paid_not_over CHECK (paid_amount <= total + 0.01)
);
CREATE INDEX idx_inv_org_status ON public.invoices(organization_id, status);
CREATE INDEX idx_inv_client ON public.invoices(client_id);
CREATE INDEX idx_inv_due ON public.invoices(organization_id, due_date);

CREATE TABLE public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric(12,2) NOT NULL DEFAULT 1,
  unit_price numeric(14,2) NOT NULL DEFAULT 0,
  discount_percent numeric(5,2) NOT NULL DEFAULT 0,
  tax_percent numeric(5,2) NOT NULL DEFAULT 0,
  line_total numeric(14,2) NOT NULL DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0
);

ALTER TABLE public.follow_ups ADD CONSTRAINT follow_ups_invoice_fk
  FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;
ALTER TABLE public.activities ADD CONSTRAINT activities_invoice_fk
  FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;

-- ===== PAYMENTS =====
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  public_id text NOT NULL DEFAULT encode(gen_random_bytes(8),'hex'),
  payment_number text NOT NULL,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  paid_on date NOT NULL DEFAULT CURRENT_DATE,
  method public.payment_method NOT NULL DEFAULT 'bank_transfer',
  reference text,
  notes text,
  status public.payment_status NOT NULL DEFAULT 'recorded',
  recorded_by uuid REFERENCES public.organization_members(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, payment_number)
);
CREATE INDEX idx_pay_invoice ON public.payments(invoice_id);
CREATE INDEX idx_pay_org_date ON public.payments(organization_id, paid_on DESC);

CREATE OR REPLACE FUNCTION public.recalc_invoice_totals(_invoice_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_total numeric(14,2);
  v_paid numeric(14,2);
  v_due date;
  v_status public.invoice_status;
BEGIN
  SELECT total, due_date, status INTO v_total, v_due, v_status FROM public.invoices WHERE id = _invoice_id;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT COALESCE(SUM(amount),0) INTO v_paid FROM public.payments
    WHERE invoice_id = _invoice_id AND status = 'recorded';
  IF v_paid > v_total + 0.01 THEN
    RAISE EXCEPTION 'Payments (%) exceed invoice total (%)', v_paid, v_total;
  END IF;
  IF v_status NOT IN ('draft','cancelled') THEN
    IF v_paid >= v_total AND v_total > 0 THEN v_status := 'paid';
    ELSIF v_paid > 0 THEN v_status := CASE WHEN v_due < CURRENT_DATE THEN 'overdue' ELSE 'partially_paid' END;
    ELSE v_status := CASE WHEN v_due < CURRENT_DATE THEN 'overdue' ELSE 'sent' END;
    END IF;
  END IF;
  UPDATE public.invoices
    SET paid_amount = v_paid,
        outstanding_amount = GREATEST(v_total - v_paid, 0),
        status = v_status,
        updated_at = now()
  WHERE id = _invoice_id;
END; $$;
REVOKE ALL ON FUNCTION public.recalc_invoice_totals(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.payments_sync_invoice()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_invoice_totals(OLD.invoice_id);
    RETURN OLD;
  END IF;
  PERFORM public.recalc_invoice_totals(NEW.invoice_id);
  IF TG_OP = 'UPDATE' AND NEW.invoice_id <> OLD.invoice_id THEN
    PERFORM public.recalc_invoice_totals(OLD.invoice_id);
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.payments_sync_invoice() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_payments_sync AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.payments_sync_invoice();

CREATE OR REPLACE FUNCTION public.invoice_before_write()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.outstanding_amount := GREATEST(COALESCE(NEW.total,0) - COALESCE(NEW.paid_amount,0), 0);
  IF NEW.status NOT IN ('draft','cancelled','paid')
     AND NEW.due_date < CURRENT_DATE AND NEW.outstanding_amount > 0 THEN
    NEW.status := 'overdue';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_invoice_before BEFORE INSERT OR UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.invoice_before_write();

-- ===== NOTIFICATIONS / AUTOMATION / SETTINGS =====
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.organization_members(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_member ON public.notifications(member_id, read_at, created_at DESC);

CREATE TABLE public.automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  trigger_event text NOT NULL,
  conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_enabled boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.org_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  invoice_prefix text NOT NULL DEFAULT 'INV-',
  quotation_prefix text NOT NULL DEFAULT 'QTN-',
  lead_prefix text NOT NULL DEFAULT 'LD-',
  deal_prefix text NOT NULL DEFAULT 'DL-',
  payment_prefix text NOT NULL DEFAULT 'PAY-',
  default_tax_percent numeric(5,2) NOT NULL DEFAULT 18,
  default_payment_terms_days int NOT NULL DEFAULT 15,
  reminder_defaults jsonb NOT NULL DEFAULT '{"followup_minutes":30,"overdue_days":[3,7,15]}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ===== GRANTS + RLS =====
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['lead_sources','lead_statuses','deal_stages','tags','clients','client_contacts',
    'leads','lead_tags','deals','follow_ups','activities','quotations','quotation_items',
    'invoices','invoice_items','payments','notifications','automation_rules','org_settings']
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated;', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role;', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
  END LOOP;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['clients','leads','follow_ups','quotations','automation_rules','org_settings','payments'] LOOP
    EXECUTE format('CREATE TRIGGER trg_%s_touch BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();', t, t);
  END LOOP;
END $$;

-- ===== POLICIES =====
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['lead_sources','lead_statuses','deal_stages','tags','automation_rules','org_settings'] LOOP
    EXECUTE format($f$CREATE POLICY "%1$s_read" ON public.%1$I FOR SELECT TO authenticated USING (public.is_org_member(organization_id));$f$, t);
    EXECUTE format($f$CREATE POLICY "%1$s_write" ON public.%1$I FOR ALL TO authenticated USING (public.has_perm(organization_id,'settings.manage')) WITH CHECK (public.has_perm(organization_id,'settings.manage'));$f$, t);
  END LOOP;
END $$;

CREATE POLICY "leads_read" ON public.leads FOR SELECT TO authenticated USING (
  public.is_org_member(organization_id) AND (
    public.has_perm(organization_id,'leads.view.all')
    OR assigned_member_id = public.current_member_id(organization_id)
    OR created_by = public.current_member_id(organization_id)
  ));
CREATE POLICY "leads_insert" ON public.leads FOR INSERT TO authenticated
  WITH CHECK (public.has_perm(organization_id,'leads.create'));
CREATE POLICY "leads_update" ON public.leads FOR UPDATE TO authenticated
  USING (public.has_perm(organization_id,'leads.update') AND (
    public.has_perm(organization_id,'leads.view.all')
    OR assigned_member_id = public.current_member_id(organization_id)))
  WITH CHECK (public.has_perm(organization_id,'leads.update'));
CREATE POLICY "leads_delete" ON public.leads FOR DELETE TO authenticated
  USING (public.has_perm(organization_id,'leads.delete'));

CREATE POLICY "lead_tags_read" ON public.lead_tags FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY "lead_tags_write" ON public.lead_tags FOR ALL TO authenticated
  USING (public.has_perm(organization_id,'leads.update')) WITH CHECK (public.has_perm(organization_id,'leads.update'));

CREATE POLICY "clients_read" ON public.clients FOR SELECT TO authenticated USING (
  public.is_org_member(organization_id) AND (
    public.has_perm(organization_id,'clients.view.all')
    OR account_manager_id = public.current_member_id(organization_id)));
CREATE POLICY "clients_insert" ON public.clients FOR INSERT TO authenticated
  WITH CHECK (public.has_perm(organization_id,'clients.manage'));
CREATE POLICY "clients_update" ON public.clients FOR UPDATE TO authenticated
  USING (public.has_perm(organization_id,'clients.manage')) WITH CHECK (public.has_perm(organization_id,'clients.manage'));
CREATE POLICY "clients_delete" ON public.clients FOR DELETE TO authenticated
  USING (public.has_perm(organization_id,'clients.delete'));

CREATE POLICY "client_contacts_read" ON public.client_contacts FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY "client_contacts_write" ON public.client_contacts FOR ALL TO authenticated
  USING (public.has_perm(organization_id,'clients.manage')) WITH CHECK (public.has_perm(organization_id,'clients.manage'));

CREATE POLICY "deals_read" ON public.deals FOR SELECT TO authenticated USING (
  public.is_org_member(organization_id) AND (
    public.has_perm(organization_id,'deals.view.all')
    OR assigned_member_id = public.current_member_id(organization_id)));
CREATE POLICY "deals_insert" ON public.deals FOR INSERT TO authenticated
  WITH CHECK (public.has_perm(organization_id,'deals.manage'));
CREATE POLICY "deals_update" ON public.deals FOR UPDATE TO authenticated
  USING (public.has_perm(organization_id,'deals.manage')) WITH CHECK (public.has_perm(organization_id,'deals.manage'));
CREATE POLICY "deals_delete" ON public.deals FOR DELETE TO authenticated
  USING (public.has_perm(organization_id,'deals.delete'));

CREATE POLICY "fu_read" ON public.follow_ups FOR SELECT TO authenticated USING (
  public.is_org_member(organization_id) AND (
    public.has_perm(organization_id,'followups.view.all')
    OR assigned_member_id = public.current_member_id(organization_id)));
CREATE POLICY "fu_write" ON public.follow_ups FOR ALL TO authenticated
  USING (public.has_perm(organization_id,'followups.manage'))
  WITH CHECK (public.has_perm(organization_id,'followups.manage'));

CREATE POLICY "act_read" ON public.activities FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY "act_insert" ON public.activities FOR INSERT TO authenticated
  WITH CHECK (public.has_perm(organization_id,'activities.create'));

CREATE POLICY "qt_read" ON public.quotations FOR SELECT TO authenticated USING (public.has_perm(organization_id,'quotations.view'));
CREATE POLICY "qt_write" ON public.quotations FOR ALL TO authenticated
  USING (public.has_perm(organization_id,'quotations.manage')) WITH CHECK (public.has_perm(organization_id,'quotations.manage'));
CREATE POLICY "qti_read" ON public.quotation_items FOR SELECT TO authenticated USING (public.has_perm(organization_id,'quotations.view'));
CREATE POLICY "qti_write" ON public.quotation_items FOR ALL TO authenticated
  USING (public.has_perm(organization_id,'quotations.manage')) WITH CHECK (public.has_perm(organization_id,'quotations.manage'));

CREATE POLICY "inv_read" ON public.invoices FOR SELECT TO authenticated USING (public.has_perm(organization_id,'invoices.view'));
CREATE POLICY "inv_write" ON public.invoices FOR ALL TO authenticated
  USING (public.has_perm(organization_id,'invoices.manage')) WITH CHECK (public.has_perm(organization_id,'invoices.manage'));
CREATE POLICY "invi_read" ON public.invoice_items FOR SELECT TO authenticated USING (public.has_perm(organization_id,'invoices.view'));
CREATE POLICY "invi_write" ON public.invoice_items FOR ALL TO authenticated
  USING (public.has_perm(organization_id,'invoices.manage')) WITH CHECK (public.has_perm(organization_id,'invoices.manage'));

CREATE POLICY "pay_read" ON public.payments FOR SELECT TO authenticated USING (public.has_perm(organization_id,'payments.view'));
CREATE POLICY "pay_write" ON public.payments FOR ALL TO authenticated
  USING (public.has_perm(organization_id,'payments.record')) WITH CHECK (public.has_perm(organization_id,'payments.record'));

CREATE POLICY "notif_read" ON public.notifications FOR SELECT TO authenticated
  USING (member_id = public.current_member_id(organization_id));
CREATE POLICY "notif_update" ON public.notifications FOR UPDATE TO authenticated
  USING (member_id = public.current_member_id(organization_id))
  WITH CHECK (member_id = public.current_member_id(organization_id));
CREATE POLICY "notif_insert" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id));

-- ===== DEFAULTS FOR NEW ORGS =====
CREATE OR REPLACE FUNCTION public.seed_new_organization()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.org_settings (organization_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;

  INSERT INTO public.lead_sources (organization_id, name, sort_order)
  SELECT NEW.id, s.name, s.ord FROM (VALUES
    ('Website',1),('Google Ads',2),('Facebook',3),('Instagram',4),('WhatsApp',5),
    ('Referral',6),('Cold Call',7),('Email',8),('Exhibition',9),('Existing Customer',10),
    ('Manual Entry',11),('Other',12)) AS s(name,ord);

  INSERT INTO public.lead_statuses (organization_id, name, color, sort_order, is_won, is_lost)
  SELECT NEW.id, s.name, s.color, s.ord, s.won, s.lost FROM (VALUES
    ('New','sky',1,false,false),('Contacted','indigo',2,false,false),('Qualified','violet',3,false,false),
    ('Proposal Sent','amber',4,false,false),('Negotiation','orange',5,false,false),
    ('Won','emerald',6,true,false),('Lost','rose',7,false,true),('Not Interested','slate',8,false,true)
  ) AS s(name,color,ord,won,lost);

  INSERT INTO public.deal_stages (organization_id, name, sort_order, default_probability, is_won, is_lost)
  SELECT NEW.id, s.name, s.ord, s.prob, s.won, s.lost FROM (VALUES
    ('Qualification',1,10,false,false),('Discovery',2,25,false,false),('Proposal',3,50,false,false),
    ('Negotiation',4,75,false,false),('Won',5,100,true,false),('Lost',6,0,false,true)
  ) AS s(name,ord,prob,won,lost);

  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.seed_new_organization() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_seed_org AFTER INSERT ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.seed_new_organization();

-- ==========================================
-- Migration: 20260808050841_2dfb99e6-951c-4f3c-ac69-c97663508639.sql
-- ==========================================

DO $$
DECLARE
  org uuid; org2 uuid;
  t_north uuid; t_west uuid;
  m_owner uuid; m_mgr uuid; m_rahul uuid; m_priya uuid; m_acct uuid;
  s_new uuid; s_cont uuid; s_qual uuid; s_prop uuid; s_neg uuid; s_won uuid; s_lost uuid;
  src_web uuid; src_ref uuid; src_ads uuid; src_cold uuid; src_exh uuid; src_wa uuid;
  st_qual uuid; st_disc uuid; st_prop uuid; st_neg uuid; st_won uuid; st_lost uuid;
  c1 uuid; c2 uuid; c3 uuid; c4 uuid; c5 uuid; c6 uuid; c7 uuid; c8 uuid;
  d1 uuid; d2 uuid; d3 uuid; d4 uuid; d5 uuid; d6 uuid; d7 uuid; d8 uuid; d9 uuid; d10 uuid;
  i1 uuid; i2 uuid; i3 uuid; i4 uuid; i5 uuid; i6 uuid;
  q1 uuid; q2 uuid;
  l9 uuid; l2 uuid; l5 uuid; l18 uuid;
  plan_pro uuid; plan_free uuid;
  o2m uuid; o2s uuid; o2st uuid;
BEGIN
  SELECT id INTO plan_pro FROM public.plans WHERE code='professional';
  SELECT id INTO plan_free FROM public.plans WHERE code='free';

  INSERT INTO public.organizations (name, slug, business_type, city, state, country, phone, email,
      tax_number, address, is_demo, onboarding_step, onboarding_completed_at)
  VALUES ('Zenith Interiors Pvt Ltd','zenith-interiors','Interior Design & Fit-out','Mumbai','Maharashtra','India',
      '+91 22 4890 1200','hello@zenithinteriors.in','27AABCZ1234K1Z5','701 Peninsula Towers, Lower Parel, Mumbai 400013',
      true, 8, now())
  RETURNING id INTO org;

  INSERT INTO public.subscriptions (organization_id, plan_id, status, trial_ends_at, renews_at)
  VALUES (org, plan_pro, 'active', now() + interval '14 days', now() + interval '27 days');

  INSERT INTO public.teams (organization_id, name, description) VALUES (org,'North Region','Delhi NCR, Punjab, UP') RETURNING id INTO t_north;
  INSERT INTO public.teams (organization_id, name, description) VALUES (org,'West Region','Maharashtra, Gujarat, Goa') RETURNING id INTO t_west;

  INSERT INTO public.organization_members (organization_id, full_name, email, role, status, team_id, joined_at)
    VALUES (org,'Anita Deshpande','anita@zenithinteriors.in','owner','active',t_west, now()-interval '400 days') RETURNING id INTO m_owner;
  INSERT INTO public.organization_members (organization_id, full_name, email, role, status, team_id, joined_at)
    VALUES (org,'Vikram Menon','vikram@zenithinteriors.in','sales_manager','active',t_west, now()-interval '320 days') RETURNING id INTO m_mgr;
  INSERT INTO public.organization_members (organization_id, full_name, email, role, status, team_id, joined_at)
    VALUES (org,'Rahul Shetty','rahul@zenithinteriors.in','sales_executive','active',t_west, now()-interval '210 days') RETURNING id INTO m_rahul;
  INSERT INTO public.organization_members (organization_id, full_name, email, role, status, team_id, joined_at)
    VALUES (org,'Priya Nair','priya@zenithinteriors.in','sales_executive','active',t_north, now()-interval '150 days') RETURNING id INTO m_priya;
  INSERT INTO public.organization_members (organization_id, full_name, email, role, status, team_id, joined_at)
    VALUES (org,'Sanjay Iyer','sanjay@zenithinteriors.in','accountant','active',NULL, now()-interval '260 days') RETURNING id INTO m_acct;

  SELECT id INTO s_new  FROM public.lead_statuses WHERE organization_id=org AND name='New';
  SELECT id INTO s_cont FROM public.lead_statuses WHERE organization_id=org AND name='Contacted';
  SELECT id INTO s_qual FROM public.lead_statuses WHERE organization_id=org AND name='Qualified';
  SELECT id INTO s_prop FROM public.lead_statuses WHERE organization_id=org AND name='Proposal Sent';
  SELECT id INTO s_neg  FROM public.lead_statuses WHERE organization_id=org AND name='Negotiation';
  SELECT id INTO s_won  FROM public.lead_statuses WHERE organization_id=org AND name='Won';
  SELECT id INTO s_lost FROM public.lead_statuses WHERE organization_id=org AND name='Lost';

  SELECT id INTO src_web  FROM public.lead_sources WHERE organization_id=org AND name='Website';
  SELECT id INTO src_ref  FROM public.lead_sources WHERE organization_id=org AND name='Referral';
  SELECT id INTO src_ads  FROM public.lead_sources WHERE organization_id=org AND name='Google Ads';
  SELECT id INTO src_cold FROM public.lead_sources WHERE organization_id=org AND name='Cold Call';
  SELECT id INTO src_exh  FROM public.lead_sources WHERE organization_id=org AND name='Exhibition';
  SELECT id INTO src_wa   FROM public.lead_sources WHERE organization_id=org AND name='WhatsApp';

  SELECT id INTO st_qual FROM public.deal_stages WHERE organization_id=org AND name='Qualification';
  SELECT id INTO st_disc FROM public.deal_stages WHERE organization_id=org AND name='Discovery';
  SELECT id INTO st_prop FROM public.deal_stages WHERE organization_id=org AND name='Proposal';
  SELECT id INTO st_neg  FROM public.deal_stages WHERE organization_id=org AND name='Negotiation';
  SELECT id INTO st_won  FROM public.deal_stages WHERE organization_id=org AND name='Won';
  SELECT id INTO st_lost FROM public.deal_stages WHERE organization_id=org AND name='Lost';

  INSERT INTO public.tags (organization_id, name, color) VALUES
    (org,'Enterprise','violet'),(org,'Retail','amber'),(org,'Repeat Client','emerald'),
    (org,'Price Sensitive','rose'),(org,'Hot','orange');

  -- CLIENTS
  INSERT INTO public.clients (organization_id, client_code, company_name, contact_person, phone, email, website,
      tax_number, billing_address, industry, account_manager_id, status, created_by, created_at) VALUES
    (org,'CL-0001','Sunrise Hospitality Group','Meera Kulkarni','+91 98200 41122','meera@sunrisehg.in','sunrisehg.in','27AACCS8821L1Z2','Plot 14, Bandra Kurla Complex, Mumbai 400051','Hospitality',m_mgr,'vip',m_owner, now()-interval '380 days') RETURNING id INTO c1;
  INSERT INTO public.clients (organization_id, client_code, company_name, contact_person, phone, email, tax_number, billing_address, industry, account_manager_id, status, created_by, created_at) VALUES
    (org,'CL-0002','Kamath Retail Ventures','Girish Kamath','+91 98450 77310','girish@kamathretail.com','29AAECK5512M1Z8','MG Road, Bengaluru 560001','Retail',m_rahul,'active',m_owner, now()-interval '300 days') RETURNING id INTO c2;
  INSERT INTO public.clients (organization_id, client_code, company_name, contact_person, phone, email, tax_number, billing_address, industry, account_manager_id, status, created_by, created_at) VALUES
    (org,'CL-0003','Arihant Realty LLP','Nikhil Jain','+91 99300 22114','nikhil@arihantrealty.in','27AAFFA1290P1ZQ','Andheri East, Mumbai 400069','Real Estate',m_mgr,'active',m_owner, now()-interval '260 days') RETURNING id INTO c3;
  INSERT INTO public.clients (organization_id, client_code, company_name, contact_person, phone, email, tax_number, billing_address, industry, account_manager_id, status, created_by, created_at) VALUES
    (org,'CL-0004','Medicare Diagnostics','Dr. Shalini Rao','+91 96540 88123','shalini@medicarediag.in','07AADCM7712H1Z4','Nehru Place, New Delhi 110019','Healthcare',m_priya,'active',m_owner, now()-interval '190 days') RETURNING id INTO c4;
  INSERT INTO public.clients (organization_id, client_code, company_name, contact_person, phone, email, tax_number, billing_address, industry, account_manager_id, status, created_by, created_at) VALUES
    (org,'CL-0005','Tanvi Fashions','Tanvi Mehta','+91 97690 10045','tanvi@tanvifashions.com','24AAGCT3311R1ZX','CG Road, Ahmedabad 380009','Apparel',m_rahul,'at_risk',m_owner, now()-interval '150 days') RETURNING id INTO c5;
  INSERT INTO public.clients (organization_id, client_code, company_name, contact_person, phone, email, tax_number, billing_address, industry, account_manager_id, status, created_by, created_at) VALUES
    (org,'CL-0006','Orbit Technologies','Arjun Pillai','+91 90040 55219','arjun@orbittech.io','36AAFCO9910N1Z7','Hitec City, Hyderabad 500081','IT Services',m_priya,'active',m_owner, now()-interval '120 days') RETURNING id INTO c6;
  INSERT INTO public.clients (organization_id, client_code, company_name, contact_person, phone, email, tax_number, billing_address, industry, account_manager_id, status, created_by, created_at) VALUES
    (org,'CL-0007','Greenleaf Cafes','Rohit Sinha','+91 98111 34567','rohit@greenleafcafes.in','07AAKCG4412J1Z1','Hauz Khas, New Delhi 110016','F&B',m_priya,'active',m_owner, now()-interval '95 days') RETURNING id INTO c7;
  INSERT INTO public.clients (organization_id, client_code, company_name, contact_person, phone, email, tax_number, billing_address, industry, account_manager_id, status, created_by, created_at) VALUES
    (org,'CL-0008','Vardhman Textiles Ltd','Suresh Agarwal','+91 98760 21188','suresh@vardhmantex.in','03AABCV6621D1Z9','Ludhiana 141003, Punjab','Manufacturing',m_mgr,'inactive',m_owner, now()-interval '60 days') RETURNING id INTO c8;

  INSERT INTO public.client_contacts (organization_id, client_id, name, job_title, phone, email, is_primary) VALUES
    (org,c1,'Meera Kulkarni','Director – Projects','+91 98200 41122','meera@sunrisehg.in',true),
    (org,c1,'Feroz Khan','Purchase Head','+91 98200 41199','feroz@sunrisehg.in',false),
    (org,c3,'Nikhil Jain','Managing Partner','+91 99300 22114','nikhil@arihantrealty.in',true),
    (org,c6,'Arjun Pillai','Head of Facilities','+91 90040 55219','arjun@orbittech.io',true);

  -- LEADS
  INSERT INTO public.leads (organization_id, lead_number, first_name, last_name, company, job_title, phone, email,
      city, state, source_id, status_id, industry, priority, estimated_value, assigned_member_id, created_by,
      last_contacted_at, next_followup_at, notes, created_at) VALUES
   (org,'LD-0001','Kavita','Raghavan','Lumina Coworking','Founder','+91 98330 11002','kavita@luminacowork.in','Pune','Maharashtra',src_web,s_new,'Coworking','high',2200000,m_rahul,m_mgr,NULL,now()+interval '4 hours','Enquiry for 12,000 sq ft coworking fit-out.',now()-interval '2 days'),
   (org,'LD-0003','Deepa','Krishnan','Nova Learning Labs','Director','+91 96320 55110','deepa@novalabs.edu.in','Chennai','Tamil Nadu',src_ads,s_cont,'Education','medium',1450000,m_priya,m_mgr,now()-interval '5 days',now()-interval '1 day','Wants a phased rollout across 3 campuses.',now()-interval '25 days'),
   (org,'LD-0004','Harish','Bhatt','Bhatt & Sons Jewellers','Owner','+91 98250 90011','harish@bhattjewellers.in','Surat','Gujarat',src_exh,s_prop,'Retail','high',3800000,m_rahul,m_mgr,now()-interval '2 days',now()+interval '3 days','Proposal sent for flagship showroom.',now()-interval '32 days'),
   (org,'LD-0006','Rakesh','Yadav','Yadav Logistics Park','Director','+91 98110 66234','rakesh@yadavlogistics.in','Gurugram','Haryana',src_cold,s_new,'Logistics','low',900000,m_priya,m_priya,NULL,now()+interval '6 days','Office block only. Small budget.',now()-interval '4 days'),
   (org,'LD-0007','Farah','Ansari','Ansari Textiles','Partner','+91 98920 47712','farah@ansaritextiles.in','Bhiwandi','Maharashtra',src_wa,s_cont,'Manufacturing','medium',1750000,m_rahul,m_rahul,now()-interval '6 days',now(),'Asked for reference projects.',now()-interval '14 days'),
   (org,'LD-0008','Manish','Gupta','Silverline Motors','GM','+91 99991 20034','manish@silverlinemotors.in','Jaipur','Rajasthan',src_ref,s_qual,'Automotive','medium',4100000,m_priya,m_mgr,now()-interval '8 days',now()+interval '5 days','Showroom + service centre.',now()-interval '29 days'),
   (org,'LD-0010','Sameer','Joshi','Joshi Pharma Distributors','Owner','+91 98220 77451','sameer@joshipharma.in','Nashik','Maharashtra',src_cold,s_lost,'Pharma','low',650000,m_rahul,m_rahul,now()-interval '30 days',NULL,'Went with a local contractor on price.',now()-interval '68 days'),
   (org,'LD-0011','Ritu','Malhotra','Malhotra Fine Dine','Proprietor','+91 98180 22119','ritu@malhotrafinedine.in','New Delhi','Delhi',src_ads,s_prop,'F&B','urgent',2400000,m_priya,m_priya,now()-interval '2 days',now()-interval '2 days','Waiting on revised quotation.',now()-interval '22 days'),
   (org,'LD-0012','Aditya','Rane','Rane Sports Academy','Founder','+91 90110 88342','aditya@raneacademy.in','Pune','Maharashtra',src_ref,s_new,'Sports','medium',1100000,m_rahul,m_rahul,NULL,now()+interval '2 days','Indoor courts and lounge area.',now()-interval '1 day'),
   (org,'LD-0013','Neha','Bansal','Bansal Educare','Trustee','+91 98991 33028','neha@bansaleducare.in','Chandigarh','Punjab',src_exh,s_cont,'Education','medium',1900000,m_priya,m_mgr,now()-interval '9 days',now()+interval '1 day','Site visit scheduled.',now()-interval '20 days'),
   (org,'LD-0014','Prakash','Nambiar','Coastal Foods Pvt Ltd','VP Ops','+91 94470 51120','prakash@coastalfoods.in','Kochi','Kerala',src_web,s_qual,'FMCG','high',3300000,m_mgr,m_mgr,now()-interval '4 days',now()+interval '4 days','Corporate office relocation.',now()-interval '27 days'),
   (org,'LD-0015','Divya','Sharma','Sharma Diagnostics','Director','+91 98290 66701','divya@sharmadiag.in','Jodhpur','Rajasthan',src_wa,s_new,'Healthcare','low',780000,m_priya,m_priya,NULL,now()+interval '8 days','Single-floor clinic.',now()-interval '3 days'),
   (org,'LD-0016','Vinod','Chandra','Chandra Auto Works','Owner','+91 98400 12234','vinod@chandraauto.in','Coimbatore','Tamil Nadu',src_cold,s_lost,'Automotive','low',560000,m_rahul,m_rahul,now()-interval '40 days',NULL,'Budget deferred to next year.',now()-interval '80 days'),
   (org,'LD-0017','Meghna','Roy','Roy & Co Chartered','Partner','+91 98300 44018','meghna@royco.in','Kolkata','West Bengal',src_ref,s_prop,'Professional Services','medium',1350000,m_priya,m_mgr,now()-interval '3 days',now()+interval '6 days','Office of 4,500 sq ft.',now()-interval '19 days'),
   (org,'LD-0019','Lakshmi','Iyer','Iyer Wellness Spa','Founder','+91 98860 33447','lakshmi@iyerspa.in','Mysuru','Karnataka',src_web,s_cont,'Wellness','medium',1050000,m_rahul,m_rahul,now()-interval '7 days',now()-interval '3 days','Needs concept drawings.',now()-interval '16 days'),
   (org,'LD-0020','Abhishek','Dubey','Dubey Constructions','MD','+91 98930 20081','abhishek@dubeyconstruct.in','Indore','Madhya Pradesh',src_exh,s_qual,'Construction','high',4600000,m_mgr,m_mgr,now()-interval '5 days',now()+interval '3 days','Sample flat interiors, 6 towers.',now()-interval '35 days'),
   (org,'LD-0021','Pooja','Reddy','Reddy Fine Jewels','Owner','+91 90000 41123','pooja@reddyfinejewels.in','Hyderabad','Telangana',src_ref,s_new,'Retail','high',2750000,m_priya,m_priya,NULL,now()+interval '5 hours','Referred by Orbit Technologies.',now()-interval '1 day'),
   (org,'LD-0022','Gaurav','Khanna','Khanna Motors Group','CEO','+91 98110 90012','gaurav@khannamotors.in','Noida','Uttar Pradesh',src_ads,s_cont,'Automotive','medium',3100000,m_priya,m_mgr,now()-interval '11 days',now()-interval '4 days','No response to last two calls.',now()-interval '30 days'),
   (org,'LD-0023','Shweta','Pandey','Pandey Boutique Stays','Founder','+91 97110 55004','shweta@pandeystays.in','Rishikesh','Uttarakhand',src_web,s_qual,'Hospitality','medium',1850000,m_mgr,m_mgr,now()-interval '6 days',now()+interval '2 days','12-room boutique property.',now()-interval '23 days'),
   (org,'LD-0024','Nitin','Kulkarni','Kulkarni Foods','Director','+91 98220 11009','nitin@kulkarnifoods.in','Pune','Maharashtra',src_wa,s_new,'FMCG','medium',1600000,m_rahul,m_rahul,NULL,now()+interval '1 day','Cafeteria and pantry redesign.',now()-interval '6 hours');

  INSERT INTO public.leads (organization_id, lead_number, first_name, last_name, company, job_title, phone, email,
      city, state, source_id, status_id, industry, priority, estimated_value, assigned_member_id, created_by,
      last_contacted_at, next_followup_at, notes, created_at)
   VALUES (org,'LD-0002','Imran','Shaikh','Blue Orchid Hotels','GM Operations','+91 99870 33421','imran@blueorchid.in','Goa','Goa',src_ref,s_qual,'Hospitality','urgent',6500000,m_mgr,m_mgr,now()-interval '3 days',now()+interval '1 day','Renovation of 48 keys. Budget approved.',now()-interval '18 days')
   RETURNING id INTO l2;
  INSERT INTO public.leads (organization_id, lead_number, first_name, last_name, company, job_title, phone, email,
      city, state, source_id, status_id, industry, priority, estimated_value, assigned_member_id, created_by,
      last_contacted_at, next_followup_at, notes, created_at)
   VALUES (org,'LD-0005','Sneha','Kulkarni','Aster Wellness Clinics','COO','+91 90280 41765','sneha@asterwellness.in','Nagpur','Maharashtra',src_web,s_neg,'Healthcare','high',2950000,m_mgr,m_owner,now()-interval '1 day',now()+interval '2 days','Negotiating on the civil works scope.',now()-interval '41 days')
   RETURNING id INTO l5;
  INSERT INTO public.leads (organization_id, lead_number, first_name, last_name, company, job_title, phone, email,
      city, state, source_id, status_id, industry, priority, estimated_value, assigned_member_id, created_by,
      last_contacted_at, next_followup_at, notes, created_at)
   VALUES (org,'LD-0018','Karan','Sethi','Sethi Hypermart','Director','+91 99880 71120','karan@sethihypermart.in','Ludhiana','Punjab',src_ads,s_neg,'Retail','urgent',7200000,m_mgr,m_owner,now()-interval '1 day',now()+interval '1 day','Final commercial round.',now()-interval '48 days')
   RETURNING id INTO l18;
  INSERT INTO public.leads (organization_id, lead_number, first_name, last_name, company, job_title, phone, email,
      city, state, source_id, status_id, industry, priority, estimated_value, assigned_member_id, created_by,
      last_contacted_at, next_followup_at, notes, created_at, converted_at, converted_client_id)
   VALUES (org,'LD-0009','Anjali','Verma','Verma Hospitality','Director','+91 98730 55123','anjali@vermahosp.in','Lucknow','Uttar Pradesh',src_web,s_won,'Hospitality','high',5200000,m_mgr,m_owner,now()-interval '20 days',NULL,'Converted — boutique hotel project.',now()-interval '75 days', now()-interval '18 days', c1)
   RETURNING id INTO l9;

  -- DEALS
  INSERT INTO public.deals (organization_id, deal_number, name, client_id, assigned_member_id, stage_id, value, probability, expected_close_date, closed_at, source, status, priority, created_by, created_at)
   VALUES (org,'DL-0001','Sunrise – Juhu Property Refresh',c1,m_mgr,st_won,8400000,100,CURRENT_DATE-40,now()-interval '40 days','Referral','won','high',m_owner,now()-interval '160 days') RETURNING id INTO d1;
  INSERT INTO public.deals (organization_id, deal_number, name, client_id, assigned_member_id, stage_id, value, probability, expected_close_date, closed_at, source, status, priority, created_by, created_at)
   VALUES (org,'DL-0002','Kamath Retail – Bengaluru Flagship',c2,m_rahul,st_won,5600000,100,CURRENT_DATE-25,now()-interval '25 days','Website','won','high',m_owner,now()-interval '120 days') RETURNING id INTO d2;
  INSERT INTO public.deals (organization_id, deal_number, name, client_id, assigned_member_id, stage_id, value, probability, expected_close_date, source, status, priority, created_by, created_at)
   VALUES (org,'DL-0003','Arihant – Sample Flat Interiors',c3,m_mgr,st_neg,4200000,75,CURRENT_DATE+18,'Referral','open','urgent',m_owner,now()-interval '55 days') RETURNING id INTO d3;
  INSERT INTO public.deals (organization_id, deal_number, name, client_id, assigned_member_id, stage_id, value, probability, expected_close_date, source, status, priority, created_by, created_at)
   VALUES (org,'DL-0004','Medicare – Delhi Lab Expansion',c4,m_priya,st_prop,2650000,50,CURRENT_DATE+22,'Google Ads','open','high',m_owner,now()-interval '38 days') RETURNING id INTO d4;
  INSERT INTO public.deals (organization_id, deal_number, name, client_id, assigned_member_id, stage_id, value, probability, expected_close_date, source, status, priority, created_by, created_at)
   VALUES (org,'DL-0005','Tanvi Fashions – Store Rollout Ph2',c5,m_rahul,st_disc,1850000,25,CURRENT_DATE+35,'Existing Customer','open','medium',m_owner,now()-interval '30 days') RETURNING id INTO d5;
  INSERT INTO public.deals (organization_id, deal_number, name, client_id, assigned_member_id, stage_id, value, probability, expected_close_date, source, status, priority, created_by, created_at)
   VALUES (org,'DL-0006','Orbit – Hyderabad Office Fit-out',c6,m_priya,st_prop,6100000,50,CURRENT_DATE+12,'Referral','open','urgent',m_owner,now()-interval '44 days') RETURNING id INTO d6;
  INSERT INTO public.deals (organization_id, deal_number, name, client_id, assigned_member_id, stage_id, value, probability, expected_close_date, source, status, priority, created_by, created_at)
   VALUES (org,'DL-0007','Greenleaf – 4 Outlet Refresh',c7,m_priya,st_qual,1400000,10,CURRENT_DATE+48,'Website','open','low',m_owner,now()-interval '18 days') RETURNING id INTO d7;
  INSERT INTO public.deals (organization_id, deal_number, name, client_id, assigned_member_id, stage_id, value, probability, expected_close_date, closed_at, source, status, priority, created_by, created_at)
   VALUES (org,'DL-0008','Vardhman – Admin Block',c8,m_mgr,st_lost,3200000,0,CURRENT_DATE-15,now()-interval '15 days','Cold Call','lost','medium',m_owner,now()-interval '90 days') RETURNING id INTO d8;
  INSERT INTO public.deals (organization_id, deal_number, name, client_id, lead_id, assigned_member_id, stage_id, value, probability, expected_close_date, source, status, priority, created_by, created_at)
   VALUES (org,'DL-0009','Blue Orchid – 48 Key Renovation',NULL,l2,m_mgr,st_disc,6500000,25,CURRENT_DATE+40,'Referral','open','urgent',m_mgr,now()-interval '15 days') RETURNING id INTO d9;
  INSERT INTO public.deals (organization_id, deal_number, name, client_id, lead_id, assigned_member_id, stage_id, value, probability, expected_close_date, source, status, priority, created_by, created_at)
   VALUES (org,'DL-0010','Sethi Hypermart – Ludhiana Store',NULL,l18,m_mgr,st_neg,7200000,75,CURRENT_DATE+9,'Google Ads','open','urgent',m_owner,now()-interval '20 days') RETURNING id INTO d10;

  UPDATE public.leads SET converted_deal_id = d1 WHERE id = l9;

  -- QUOTATIONS
  INSERT INTO public.quotations (organization_id, quotation_number, client_id, deal_id, issue_date, expiry_date,
      subtotal, discount_total, tax_total, total, status, terms, created_by, created_at)
   VALUES (org,'QTN-0007',c3,d3,CURRENT_DATE-12,CURRENT_DATE+18,4200000,100000,738000,4838000,'sent','50% advance, 40% on delivery, 10% on handover.',m_mgr,now()-interval '12 days') RETURNING id INTO q1;
  INSERT INTO public.quotations (organization_id, quotation_number, client_id, deal_id, issue_date, expiry_date,
      subtotal, discount_total, tax_total, total, status, terms, created_by, created_at)
   VALUES (org,'QTN-0008',c6,d6,CURRENT_DATE-6,CURRENT_DATE+24,6100000,0,1098000,7198000,'viewed','40% advance, balance milestone-linked.',m_priya,now()-interval '6 days') RETURNING id INTO q2;
  INSERT INTO public.quotation_items (organization_id, quotation_id, description, quantity, unit_price, discount_percent, tax_percent, line_total, sort_order) VALUES
   (org,q1,'Modular furniture and workstations',1,2400000,0,18,2832000,1),
   (org,q1,'Civil, ceiling and flooring works',1,1800000,5,18,2018520,2),
   (org,q2,'Interior design and 3D visualisation',1,600000,0,18,708000,1),
   (org,q2,'Turnkey fit-out execution – 18,000 sq ft',1,5500000,0,18,6490000,2);

  -- INVOICES
  INSERT INTO public.invoices (organization_id, invoice_number, client_id, deal_id, issue_date, due_date,
      subtotal, tax_total, total, status, terms, created_by, created_at)
   VALUES (org,'INV-0021',c1,d1,CURRENT_DATE-38,CURRENT_DATE-23,8400000,1512000,9912000,'sent','Net 15',m_acct,now()-interval '38 days') RETURNING id INTO i1;
  INSERT INTO public.invoices (organization_id, invoice_number, client_id, deal_id, issue_date, due_date,
      subtotal, tax_total, total, status, terms, created_by, created_at)
   VALUES (org,'INV-0022',c2,d2,CURRENT_DATE-24,CURRENT_DATE-9,5600000,1008000,6608000,'sent','Net 15',m_acct,now()-interval '24 days') RETURNING id INTO i2;
  INSERT INTO public.invoices (organization_id, invoice_number, client_id, issue_date, due_date,
      subtotal, tax_total, total, status, terms, created_by, created_at)
   VALUES (org,'INV-0023',c4,CURRENT_DATE-18,CURRENT_DATE-3,1250000,225000,1475000,'sent','Net 15',m_acct,now()-interval '18 days') RETURNING id INTO i3;
  INSERT INTO public.invoices (organization_id, invoice_number, client_id, issue_date, due_date,
      subtotal, tax_total, total, status, terms, created_by, created_at)
   VALUES (org,'INV-0024',c5,CURRENT_DATE-45,CURRENT_DATE-30,980000,176400,1156400,'sent','Net 15',m_acct,now()-interval '45 days') RETURNING id INTO i4;
  INSERT INTO public.invoices (organization_id, invoice_number, client_id, issue_date, due_date,
      subtotal, tax_total, total, status, terms, created_by, created_at)
   VALUES (org,'INV-0025',c6,CURRENT_DATE-4,CURRENT_DATE+11,2100000,378000,2478000,'sent','Net 15',m_acct,now()-interval '4 days') RETURNING id INTO i5;
  INSERT INTO public.invoices (organization_id, invoice_number, client_id, issue_date, due_date,
      subtotal, tax_total, total, status, terms, created_by, created_at)
   VALUES (org,'INV-0026',c7,CURRENT_DATE-1,CURRENT_DATE+14,640000,115200,755200,'draft','Net 15',m_acct,now()-interval '1 day') RETURNING id INTO i6;

  INSERT INTO public.invoice_items (organization_id, invoice_id, description, quantity, unit_price, tax_percent, line_total, sort_order) VALUES
   (org,i1,'Turnkey interior fit-out – Juhu property',1,8400000,18,9912000,1),
   (org,i2,'Flagship store fit-out – Bengaluru',1,5600000,18,6608000,1),
   (org,i3,'Lab expansion – civil and MEP works',1,1250000,18,1475000,1),
   (org,i4,'Store refresh – Ahmedabad',1,980000,18,1156400,1),
   (org,i5,'Design retainer and site mobilisation',1,2100000,18,2478000,1),
   (org,i6,'Outlet refresh – concept and drawings',1,640000,18,755200,1);

  -- PAYMENTS (triggers recalculate invoice paid/outstanding/status)
  INSERT INTO public.payments (organization_id, payment_number, invoice_id, client_id, deal_id, amount, paid_on, method, reference, recorded_by, created_at) VALUES
   (org,'PAY-0031',i1,c1,d1,5000000,CURRENT_DATE-30,'bank_transfer','NEFT/HDFC/884213',m_acct,now()-interval '30 days'),
   (org,'PAY-0032',i1,c1,d1,4912000,CURRENT_DATE-20,'bank_transfer','NEFT/HDFC/889902',m_acct,now()-interval '20 days'),
   (org,'PAY-0033',i2,c2,d2,3000000,CURRENT_DATE-14,'bank_transfer','RTGS/ICIC/551200',m_acct,now()-interval '14 days'),
   (org,'PAY-0034',i3,c4,NULL,475000,CURRENT_DATE-8,'upi','UPI/9821/44120',m_acct,now()-interval '8 days'),
   (org,'PAY-0035',i5,c6,NULL,1000000,CURRENT_DATE-2,'cheque','CHQ 442190',m_acct,now()-interval '2 days');

  -- FOLLOW-UPS
  INSERT INTO public.follow_ups (organization_id, lead_id, client_id, deal_id, invoice_id, assigned_member_id, type, due_at, priority, status, subject, notes, created_by, created_at) VALUES
   (org,l2,NULL,d9,NULL,m_mgr,'call',date_trunc('day',now())+interval '11 hours','urgent','pending','Confirm site survey date','Client asked to call before 12 pm.',m_mgr,now()-interval '3 days'),
   (org,NULL,c3,d3,NULL,m_mgr,'meeting',date_trunc('day',now())+interval '15 hours 30 minutes','high','pending','Commercial discussion at Andheri office',NULL,m_owner,now()-interval '5 days'),
   (org,NULL,c4,NULL,i3,m_acct,'payment_reminder',date_trunc('day',now())+interval '17 hours','high','pending','Follow up balance ₹10,00,000','Invoice INV-0023 is past due.',m_acct,now()-interval '2 days'),
   (org,NULL,c5,NULL,i4,m_acct,'payment_reminder',now()-interval '2 days','urgent','pending','Overdue payment – Tanvi Fashions','No response to two reminders.',m_acct,now()-interval '10 days'),
   (org,NULL,NULL,d10,NULL,m_mgr,'call',now()-interval '1 day','urgent','pending','Chase final commercial approval',NULL,m_owner,now()-interval '6 days'),
   (org,NULL,c6,d6,NULL,m_priya,'demo',now()+interval '2 days','high','pending','Material and finish samples walkthrough',NULL,m_priya,now()-interval '4 days'),
   (org,NULL,c2,NULL,i2,m_acct,'payment_reminder',now()+interval '3 days','medium','pending','Collect balance ₹36,08,000',NULL,m_acct,now()-interval '5 days'),
   (org,NULL,c1,d1,NULL,m_mgr,'meeting',now()-interval '12 days','high','completed','Project handover review','Walkthrough completed with Meera.',m_mgr,now()-interval '20 days'),
   (org,NULL,c2,d2,NULL,m_rahul,'call',now()-interval '6 days','medium','completed','Post-handover check-in',NULL,m_rahul,now()-interval '12 days');

  UPDATE public.follow_ups SET completed_at = due_at + interval '1 hour',
    outcome = CASE WHEN subject = 'Project handover review'
      THEN 'Client happy with delivery. Asked for a quote on the Powai property.'
      ELSE 'Store operating well. Will revisit Phase 2 next quarter.' END
   WHERE organization_id=org AND status='completed';

  -- ACTIVITIES
  INSERT INTO public.activities (organization_id, type, title, description, lead_id, client_id, deal_id, actor_member_id, actor_name, occurred_at) VALUES
   (org,'lead_created','Lead created','Blue Orchid Hotels added from a referral.',l2,NULL,NULL,m_mgr,'Vikram Menon',now()-interval '18 days'),
   (org,'call','Call completed','Discussed scope for 48 keys. Budget confirmed at ₹65 L.',l2,NULL,NULL,m_mgr,'Vikram Menon',now()-interval '3 days'),
   (org,'deal_created','Deal created','Blue Orchid – 48 Key Renovation created at ₹65,00,000.',l2,NULL,d9,m_mgr,'Vikram Menon',now()-interval '15 days'),
   (org,'status_changed','Status changed','Lead moved from Contacted to Qualified.',l2,NULL,NULL,m_mgr,'Vikram Menon',now()-interval '10 days'),
   (org,'quotation_sent','Quotation sent','QTN-0007 sent to Arihant Realty LLP for ₹48,38,000.',NULL,c3,d3,m_mgr,'Vikram Menon',now()-interval '12 days'),
   (org,'deal_updated','Stage changed','Arihant deal moved from Proposal to Negotiation.',NULL,c3,d3,m_mgr,'Vikram Menon',now()-interval '5 days'),
   (org,'deal_won','Deal won','Sunrise – Juhu Property Refresh won at ₹84,00,000.',NULL,c1,d1,m_mgr,'Vikram Menon',now()-interval '40 days'),
   (org,'invoice_created','Invoice created','INV-0021 raised for ₹99,12,000.',NULL,c1,d1,m_acct,'Sanjay Iyer',now()-interval '38 days'),
   (org,'payment_received','Payment received','₹50,00,000 received against INV-0021.',NULL,c1,d1,m_acct,'Sanjay Iyer',now()-interval '30 days'),
   (org,'payment_received','Payment received','₹49,12,000 received against INV-0021. Invoice fully paid.',NULL,c1,d1,m_acct,'Sanjay Iyer',now()-interval '20 days'),
   (org,'followup_completed','Follow-up completed','Project handover review completed.',NULL,c1,d1,m_mgr,'Vikram Menon',now()-interval '12 days'),
   (org,'payment_reminder','Payment reminder sent','Reminder sent to Tanvi Fashions for INV-0024.',NULL,c5,NULL,m_acct,'Sanjay Iyer',now()-interval '4 days'),
   (org,'note','Note added','Client wants LEED-compliant materials throughout.',NULL,c6,d6,m_priya,'Priya Nair',now()-interval '2 days'),
   (org,'deal_lost','Deal lost','Vardhman – Admin Block lost on commercials.',NULL,c8,d8,m_mgr,'Vikram Menon',now()-interval '15 days');

  -- NOTIFICATIONS
  INSERT INTO public.notifications (organization_id, member_id, type, title, body, link, created_at) VALUES
   (org,m_mgr,'followup_due','Follow-up due today','Call Imran Shaikh – Blue Orchid Hotels at 11:00 AM.','/followups',now()-interval '2 hours'),
   (org,m_mgr,'followup_overdue','Follow-up overdue','Chase final commercial approval – Sethi Hypermart.','/followups',now()-interval '1 day'),
   (org,m_acct,'invoice_overdue','Invoice overdue','INV-0024 for Tanvi Fashions is 30 days overdue.','/invoices',now()-interval '3 days'),
   (org,m_acct,'payment_received','Payment received','₹10,00,000 received from Orbit Technologies.','/payments',now()-interval '2 days'),
   (org,m_priya,'lead_assigned','New lead assigned','Reddy Fine Jewels was assigned to you.','/leads',now()-interval '1 day');

  -- AUTOMATIONS
  INSERT INTO public.automation_rules (organization_id, name, description, trigger_event, conditions, actions) VALUES
   (org,'Follow up after proposal','Create a call follow-up 3 days after a lead reaches Proposal Sent.','lead.status_changed',
    '{"to_status":"Proposal Sent"}','[{"type":"create_followup","offset_days":3,"followup_type":"call","priority":"high"}]'),
   (org,'Chase overdue invoices','Create a payment follow-up when an invoice goes 3 days overdue.','invoice.overdue',
    '{"days_overdue":3}','[{"type":"create_followup","followup_type":"payment_reminder","priority":"urgent"}]'),
   (org,'Onboard won deals','When a deal is won, create the client if needed and add an onboarding task.','deal.won',
    '{}','[{"type":"ensure_client"},{"type":"create_followup","offset_days":2,"followup_type":"meeting","subject":"Kick-off and onboarding"}]');

  -- ===== SECOND ORG (isolation check) =====
  INSERT INTO public.organizations (name, slug, business_type, city, country, currency, currency_symbol, is_demo)
  VALUES ('Northwind Traders','northwind-traders','Wholesale Distribution','Pune','India','INR','₹', false)
  RETURNING id INTO org2;
  INSERT INTO public.subscriptions (organization_id, plan_id, status) VALUES (org2, plan_free, 'active');
  INSERT INTO public.organization_members (organization_id, full_name, email, role, status, joined_at)
   VALUES (org2,'Ramesh Gokhale','ramesh@northwindtraders.in','owner','active',now()-interval '30 days') RETURNING id INTO o2m;
  SELECT id INTO o2s FROM public.lead_sources WHERE organization_id=org2 AND name='Website';
  SELECT id INTO o2st FROM public.lead_statuses WHERE organization_id=org2 AND name='New';
  INSERT INTO public.clients (organization_id, client_code, company_name, contact_person, phone, email, account_manager_id, created_by)
   VALUES (org2,'CL-0001','Konkan Distributors','Sagar Patil','+91 90210 33440','sagar@konkandist.in',o2m,o2m);
  INSERT INTO public.leads (organization_id, lead_number, first_name, last_name, company, phone, email, city,
      source_id, status_id, priority, estimated_value, assigned_member_id, created_by)
   VALUES (org2,'LD-0001','Sagar','Patil','Konkan Distributors','+91 90210 33440','sagar@konkandist.in','Pune',o2s,o2st,'medium',450000,o2m,o2m),
          (org2,'LD-0002','Alka','Deo','Deo Traders','+91 90210 88112','alka@deotraders.in','Nashik',o2s,o2st,'low',260000,o2m,o2m);
END $$;

-- ==========================================
-- Migration: 20260808051511_904697fa-4afd-4274-87ae-1a13f2296093.sql
-- ==========================================

-- Generic per-organization record numbering.
CREATE OR REPLACE FUNCTION public.next_record_number(
  _org_id uuid,
  _table text,
  _column text,
  _prefix text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _next integer;
BEGIN
  EXECUTE format(
    'SELECT COALESCE(MAX(NULLIF(regexp_replace(%I, ''\D'', '''', ''g''), '''')::int), 0) + 1
       FROM public.%I WHERE organization_id = $1',
    _column, _table
  ) INTO _next USING _org_id;

  RETURN _prefix || '-' || lpad(_next::text, 4, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.next_record_number(uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.next_record_number(uuid, text, text, text) FROM anon;

CREATE OR REPLACE FUNCTION public.set_lead_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.lead_number IS NULL OR btrim(NEW.lead_number) = '' THEN
    NEW.lead_number := public.next_record_number(NEW.organization_id, 'leads', 'lead_number', 'LD');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_client_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.client_code IS NULL OR btrim(NEW.client_code) = '' THEN
    NEW.client_code := public.next_record_number(NEW.organization_id, 'clients', 'client_code', 'CL');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_deal_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.deal_number IS NULL OR btrim(NEW.deal_number) = '' THEN
    NEW.deal_number := public.next_record_number(NEW.organization_id, 'deals', 'deal_number', 'DL');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_quotation_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.quotation_number IS NULL OR btrim(NEW.quotation_number) = '' THEN
    NEW.quotation_number := public.next_record_number(NEW.organization_id, 'quotations', 'quotation_number', 'QT');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_invoice_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR btrim(NEW.invoice_number) = '' THEN
    NEW.invoice_number := public.next_record_number(NEW.organization_id, 'invoices', 'invoice_number', 'IN');
  END IF;
  RETURN NEW;
END;
$$;

-- Make the columns optional on insert so the triggers can fill them.
ALTER TABLE public.leads ALTER COLUMN lead_number DROP NOT NULL;
ALTER TABLE public.clients ALTER COLUMN client_code DROP NOT NULL;
ALTER TABLE public.deals ALTER COLUMN deal_number DROP NOT NULL;
ALTER TABLE public.quotations ALTER COLUMN quotation_number DROP NOT NULL;
ALTER TABLE public.invoices ALTER COLUMN invoice_number DROP NOT NULL;

DROP TRIGGER IF EXISTS trg_set_lead_number ON public.leads;
CREATE TRIGGER trg_set_lead_number BEFORE INSERT ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.set_lead_number();

DROP TRIGGER IF EXISTS trg_set_client_code ON public.clients;
CREATE TRIGGER trg_set_client_code BEFORE INSERT ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.set_client_code();

DROP TRIGGER IF EXISTS trg_set_deal_number ON public.deals;
CREATE TRIGGER trg_set_deal_number BEFORE INSERT ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.set_deal_number();

DROP TRIGGER IF EXISTS trg_set_quotation_number ON public.quotations;
CREATE TRIGGER trg_set_quotation_number BEFORE INSERT ON public.quotations
FOR EACH ROW EXECUTE FUNCTION public.set_quotation_number();

DROP TRIGGER IF EXISTS trg_set_invoice_number ON public.invoices;
CREATE TRIGGER trg_set_invoice_number BEFORE INSERT ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.set_invoice_number();

-- ==========================================
-- Migration: 20260808052715_79c3f3e6-bc3c-4d94-b996-5c1c1f76e406.sql
-- ==========================================

CREATE OR REPLACE FUNCTION public.set_payment_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.payment_number IS NULL OR btrim(NEW.payment_number) = '' THEN
    NEW.payment_number := public.next_record_number(NEW.organization_id, 'payments', 'payment_number', 'PY');
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_set_payment_number ON public.payments;
CREATE TRIGGER trg_set_payment_number
BEFORE INSERT ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.set_payment_number();

ALTER TABLE public.payments ALTER COLUMN payment_number DROP NOT NULL;

-- ==========================================
-- Migration: 20260808052740_d2075f1b-f8d4-4dca-af81-126a9c3b393c.sql
-- ==========================================

REVOKE ALL ON FUNCTION public.next_record_number(uuid, text, text, text) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.recalc_invoice_totals(uuid) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.set_payment_number() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.set_lead_number() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.set_client_code() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.set_deal_number() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.set_invoice_number() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.set_quotation_number() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.payments_sync_invoice() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.seed_new_organization() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.deal_weighted() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.invoice_before_write() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.is_org_member(uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.has_perm(uuid, text) FROM anon, public;
REVOKE ALL ON FUNCTION public.current_member_id(uuid) FROM anon, public;

-- ==========================================
-- Migration: 20260808080357_a971edc1-ec81-4d99-baf2-90285f46e436.sql
-- ==========================================

-- product type enum
DO $$ BEGIN
  CREATE TYPE public.product_kind AS ENUM ('service','product');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  kind public.product_kind NOT NULL DEFAULT 'service',
  category text,
  description text,
  unit text NOT NULL DEFAULT 'unit',
  unit_price numeric(14,2) NOT NULL DEFAULT 0,
  cost_price numeric(14,2),
  tax_percent numeric(6,2) NOT NULL DEFAULT 18,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  notes text,
  created_by uuid REFERENCES public.organization_members(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX products_org_idx ON public.products (organization_id, is_active, sort_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_select_org" ON public.products
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY "products_insert" ON public.products
  FOR INSERT TO authenticated WITH CHECK (public.has_perm(organization_id, 'settings.manage'));
CREATE POLICY "products_update" ON public.products
  FOR UPDATE TO authenticated USING (public.has_perm(organization_id, 'settings.manage'))
  WITH CHECK (public.has_perm(organization_id, 'settings.manage'));
CREATE POLICY "products_delete" ON public.products
  FOR DELETE TO authenticated USING (public.has_perm(organization_id, 'settings.manage'));

CREATE TRIGGER trg_products_touch BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- link table: catalogue item attached to a lead and/or follow-up
CREATE TABLE public.record_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  follow_up_id uuid REFERENCES public.follow_ups(id) ON DELETE CASCADE,
  quantity numeric(12,2) NOT NULL DEFAULT 1,
  unit_price numeric(14,2) NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX record_products_lead_idx ON public.record_products (lead_id);
CREATE INDEX record_products_followup_idx ON public.record_products (follow_up_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.record_products TO authenticated;
GRANT ALL ON public.record_products TO service_role;

ALTER TABLE public.record_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "record_products_select_org" ON public.record_products
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY "record_products_insert" ON public.record_products
  FOR INSERT TO authenticated WITH CHECK (public.has_perm(organization_id, 'leads.edit'));
CREATE POLICY "record_products_update" ON public.record_products
  FOR UPDATE TO authenticated USING (public.has_perm(organization_id, 'leads.edit'))
  WITH CHECK (public.has_perm(organization_id, 'leads.edit'));
CREATE POLICY "record_products_delete" ON public.record_products
  FOR DELETE TO authenticated USING (public.has_perm(organization_id, 'leads.edit'));

-- seed a starter catalogue for new orgs
CREATE OR REPLACE FUNCTION public.seed_new_organization()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.org_settings (organization_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;

  INSERT INTO public.lead_sources (organization_id, name, sort_order)
  SELECT NEW.id, s.name, s.ord FROM (VALUES
    ('Website',1),('Google Ads',2),('Facebook',3),('Instagram',4),('WhatsApp',5),
    ('Referral',6),('Cold Call',7),('Email',8),('Exhibition',9),('Existing Customer',10),
    ('Manual Entry',11),('Other',12)) AS s(name,ord);

  INSERT INTO public.lead_statuses (organization_id, name, color, sort_order, is_won, is_lost)
  SELECT NEW.id, s.name, s.color, s.ord, s.won, s.lost FROM (VALUES
    ('New','sky',1,false,false),('Contacted','indigo',2,false,false),('Qualified','violet',3,false,false),
    ('Proposal Sent','amber',4,false,false),('Negotiation','orange',5,false,false),
    ('Won','emerald',6,true,false),('Lost','rose',7,false,true),('Not Interested','slate',8,false,true)
  ) AS s(name,color,ord,won,lost);

  INSERT INTO public.deal_stages (organization_id, name, sort_order, default_probability, is_won, is_lost)
  SELECT NEW.id, s.name, s.ord, s.prob, s.won, s.lost FROM (VALUES
    ('Qualification',1,10,false,false),('Discovery',2,25,false,false),('Proposal',3,50,false,false),
    ('Negotiation',4,75,false,false),('Won',5,100,true,false),('Lost',6,0,false,true)
  ) AS s(name,ord,prob,won,lost);

  INSERT INTO public.products (organization_id, name, code, kind, category, unit, unit_price, tax_percent, sort_order, description)
  SELECT NEW.id, p.name, p.code, p.kind::public.product_kind, p.cat, p.unit, p.price, 18, p.ord, p.descr FROM (VALUES
    ('Interior Design Consultation','SV-001','service','Consulting','session',5000,1,'On-site consultation and requirement capture'),
    ('2D Floor Plan Design','SV-002','service','Design','plan',15000,2,'Detailed 2D layout with measurements'),
    ('3D Visualisation','SV-003','service','Design','room',12000,3,'Photorealistic 3D render per room'),
    ('Modular Kitchen Package','PR-001','product','Modular','unit',250000,4,'End-to-end modular kitchen supply and install'),
    ('Wardrobe (per sq.ft.)','PR-002','product','Modular','sq.ft.',1450,5,'Custom wardrobe fabrication'),
    ('Turnkey Project Management','SV-004','service','Execution','project',75000,6,'Site supervision and vendor coordination')
  ) AS p(name,code,kind,cat,unit,price,ord,descr);

  RETURN NEW;
END; $function$;

-- backfill starter catalogue for existing orgs
INSERT INTO public.products (organization_id, name, code, kind, category, unit, unit_price, tax_percent, sort_order, description)
SELECT o.id, p.name, p.code, p.kind::public.product_kind, p.cat, p.unit, p.price, 18, p.ord, p.descr
FROM public.organizations o
CROSS JOIN (VALUES
  ('Interior Design Consultation','SV-001','service','Consulting','session',5000,1,'On-site consultation and requirement capture'),
  ('2D Floor Plan Design','SV-002','service','Design','plan',15000,2,'Detailed 2D layout with measurements'),
  ('3D Visualisation','SV-003','service','Design','room',12000,3,'Photorealistic 3D render per room'),
  ('Modular Kitchen Package','PR-001','product','Modular','unit',250000,4,'End-to-end modular kitchen supply and install'),
  ('Wardrobe (per sq.ft.)','PR-002','product','Modular','sq.ft.',1450,5,'Custom wardrobe fabrication'),
  ('Turnkey Project Management','SV-004','service','Execution','project',75000,6,'Site supervision and vendor coordination')
) AS p(name,code,kind,cat,unit,price,ord,descr);

-- ==========================================
-- Migration: 20260808081850_393d35d5-3cf3-4199-9efc-cdd7bbd39bd3.sql
-- ==========================================

-- 1. Missing Data API grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.record_products TO authenticated;
GRANT ALL ON public.record_products TO service_role;

-- 2. Collections
CREATE TABLE public.product_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.organization_members(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_collections TO authenticated;
GRANT ALL ON public.product_collections TO service_role;

ALTER TABLE public.product_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY product_collections_select_org ON public.product_collections
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY product_collections_insert ON public.product_collections
  FOR INSERT TO authenticated WITH CHECK (public.has_perm(organization_id, 'settings.manage'));
CREATE POLICY product_collections_update ON public.product_collections
  FOR UPDATE TO authenticated USING (public.has_perm(organization_id, 'settings.manage'))
  WITH CHECK (public.has_perm(organization_id, 'settings.manage'));
CREATE POLICY product_collections_delete ON public.product_collections
  FOR DELETE TO authenticated USING (public.has_perm(organization_id, 'settings.manage'));

CREATE TRIGGER trg_product_collections_touch BEFORE UPDATE ON public.product_collections
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.products
  ADD COLUMN collection_id uuid REFERENCES public.product_collections(id) ON DELETE SET NULL;

CREATE INDEX idx_products_collection ON public.products(collection_id);

-- 3. Backfill: one collection per existing org, seeded from existing categories
INSERT INTO public.product_collections (organization_id, name, sort_order)
SELECT o.id, c.name, c.ord
FROM public.organizations o
CROSS JOIN (VALUES ('Consulting',1),('Design',2),('Modular',3),('Execution',4),('General',5)) AS c(name, ord)
ON CONFLICT DO NOTHING;

UPDATE public.products p
SET collection_id = pc.id
FROM public.product_collections pc
WHERE pc.organization_id = p.organization_id
  AND pc.name = COALESCE(NULLIF(btrim(p.category), ''), 'General')
  AND p.collection_id IS NULL;

UPDATE public.products p
SET collection_id = pc.id
FROM public.product_collections pc
WHERE pc.organization_id = p.organization_id
  AND pc.name = 'General'
  AND p.collection_id IS NULL;

-- 4. New orgs get starter collections + catalogue linked to them
CREATE OR REPLACE FUNCTION public.seed_new_organization()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.org_settings (organization_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;

  INSERT INTO public.lead_sources (organization_id, name, sort_order)
  SELECT NEW.id, s.name, s.ord FROM (VALUES
    ('Website',1),('Google Ads',2),('Facebook',3),('Instagram',4),('WhatsApp',5),
    ('Referral',6),('Cold Call',7),('Email',8),('Exhibition',9),('Existing Customer',10),
    ('Manual Entry',11),('Other',12)) AS s(name,ord);

  INSERT INTO public.lead_statuses (organization_id, name, color, sort_order, is_won, is_lost)
  SELECT NEW.id, s.name, s.color, s.ord, s.won, s.lost FROM (VALUES
    ('New','sky',1,false,false),('Contacted','indigo',2,false,false),('Qualified','violet',3,false,false),
    ('Proposal Sent','amber',4,false,false),('Negotiation','orange',5,false,false),
    ('Won','emerald',6,true,false),('Lost','rose',7,false,true),('Not Interested','slate',8,false,true)
  ) AS s(name,color,ord,won,lost);

  INSERT INTO public.deal_stages (organization_id, name, sort_order, default_probability, is_won, is_lost)
  SELECT NEW.id, s.name, s.ord, s.prob, s.won, s.lost FROM (VALUES
    ('Qualification',1,10,false,false),('Discovery',2,25,false,false),('Proposal',3,50,false,false),
    ('Negotiation',4,75,false,false),('Won',5,100,true,false),('Lost',6,0,false,true)
  ) AS s(name,ord,prob,won,lost);

  INSERT INTO public.product_collections (organization_id, name, description, sort_order)
  SELECT NEW.id, c.name, c.descr, c.ord FROM (VALUES
    ('Consulting','Advisory and consultation offerings',1),
    ('Design','Design and visualisation deliverables',2),
    ('Modular','Manufactured and modular supply',3),
    ('Execution','On-site execution and management',4),
    ('General','Everything else',5)
  ) AS c(name,descr,ord);

  INSERT INTO public.products (organization_id, collection_id, name, code, kind, category, unit, unit_price, tax_percent, sort_order, description)
  SELECT NEW.id,
         (SELECT id FROM public.product_collections pc WHERE pc.organization_id = NEW.id AND pc.name = p.cat),
         p.name, p.code, p.kind::public.product_kind, p.cat, p.unit, p.price, 18, p.ord, p.descr
  FROM (VALUES
    ('Interior Design Consultation','SV-001','service','Consulting','session',5000,1,'On-site consultation and requirement capture'),
    ('2D Floor Plan Design','SV-002','service','Design','plan',15000,2,'Detailed 2D layout with measurements'),
    ('3D Visualisation','SV-003','service','Design','room',12000,3,'Photorealistic 3D render per room'),
    ('Modular Kitchen Package','PR-001','product','Modular','unit',250000,4,'End-to-end modular kitchen supply and install'),
    ('Wardrobe (per sq.ft.)','PR-002','product','Modular','sq.ft.',1450,5,'Custom wardrobe fabrication'),
    ('Turnkey Project Management','SV-004','service','Execution','project',75000,6,'Site supervision and vendor coordination')
  ) AS p(name,code,kind,cat,unit,price,ord,descr);

  RETURN NEW;
END; $function$;

-- ==========================================
-- Migration: 20260808084349_53c16eed-8c51-42a4-949d-acd6ec493f0b.sql
-- ==========================================

DROP POLICY IF EXISTS record_products_insert ON public.record_products;
DROP POLICY IF EXISTS record_products_update ON public.record_products;
DROP POLICY IF EXISTS record_products_delete ON public.record_products;

CREATE POLICY record_products_insert
ON public.record_products
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_org_member(organization_id)
  AND EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_id
      AND p.organization_id = organization_id
  )
  AND (
    (
      lead_id IS NOT NULL
      AND follow_up_id IS NULL
      AND public.has_perm(organization_id, 'leads.update')
      AND EXISTS (
        SELECT 1 FROM public.leads l
        WHERE l.id = lead_id
          AND l.organization_id = organization_id
      )
    )
    OR
    (
      follow_up_id IS NOT NULL
      AND lead_id IS NULL
      AND public.has_perm(organization_id, 'followups.manage')
      AND EXISTS (
        SELECT 1 FROM public.follow_ups f
        WHERE f.id = follow_up_id
          AND f.organization_id = organization_id
      )
    )
  )
);

CREATE POLICY record_products_update
ON public.record_products
FOR UPDATE
TO authenticated
USING (
  public.is_org_member(organization_id)
  AND (
    (lead_id IS NOT NULL AND public.has_perm(organization_id, 'leads.update'))
    OR (follow_up_id IS NOT NULL AND public.has_perm(organization_id, 'followups.manage'))
  )
)
WITH CHECK (
  public.is_org_member(organization_id)
  AND EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_id
      AND p.organization_id = organization_id
  )
  AND (
    (
      lead_id IS NOT NULL
      AND follow_up_id IS NULL
      AND public.has_perm(organization_id, 'leads.update')
      AND EXISTS (
        SELECT 1 FROM public.leads l
        WHERE l.id = lead_id
          AND l.organization_id = organization_id
      )
    )
    OR
    (
      follow_up_id IS NOT NULL
      AND lead_id IS NULL
      AND public.has_perm(organization_id, 'followups.manage')
      AND EXISTS (
        SELECT 1 FROM public.follow_ups f
        WHERE f.id = follow_up_id
          AND f.organization_id = organization_id
      )
    )
  )
);

CREATE POLICY record_products_delete
ON public.record_products
FOR DELETE
TO authenticated
USING (
  public.is_org_member(organization_id)
  AND (
    (lead_id IS NOT NULL AND public.has_perm(organization_id, 'leads.update'))
    OR (follow_up_id IS NOT NULL AND public.has_perm(organization_id, 'followups.manage'))
  )
);

-- ==========================================
-- Migration: 20260809110000_add_meeting_link_to_followups.sql
-- ==========================================

-- Migration: Add meeting_link to public.follow_ups table
ALTER TABLE public.follow_ups ADD COLUMN IF NOT EXISTS meeting_link text;

-- Index for searching/filtering follow-ups with meeting links
CREATE INDEX IF NOT EXISTS idx_fu_meeting_link ON public.follow_ups(organization_id, meeting_link) WHERE meeting_link IS NOT NULL;


-- ==========================================
-- Migration: 20260810124500_fix_member_delete_rls_and_owner_isolation.sql
-- ==========================================

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


