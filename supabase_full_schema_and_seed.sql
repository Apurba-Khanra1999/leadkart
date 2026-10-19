-- LEADKART COMPLETE DATABASE SCHEMA AND INITIAL SEED
-- Project ID: mmucchbxfbjnlkwceohk

-- =====================================================================
-- COMPLETE DATABASE RESET & SCHEMA RECREATION
-- Drop existing public schema and all objects to prevent "already exists" errors
-- =====================================================================
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

-- Grant default privileges to Supabase roles
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
GRANT ALL ON SCHEMA public TO anon;
GRANT ALL ON SCHEMA public TO authenticated;
GRANT ALL ON SCHEMA public TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;

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

  RETURN NEW;
END; $function$;



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

-- ==========================================
-- Migration: 20260813180000_create_forms_and_submissions.sql
-- ==========================================

CREATE TABLE IF NOT EXISTS public.forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  submit_button_text text NOT NULL DEFAULT 'Submit',
  success_message text NOT NULL DEFAULT 'Thank you! Your response has been recorded.',
  redirect_url text,
  is_active boolean NOT NULL DEFAULT true,
  accent_color text NOT NULL DEFAULT '#2563eb',
  default_theme text NOT NULL DEFAULT 'light',
  auto_create_lead boolean NOT NULL DEFAULT true,
  default_lead_source_id uuid REFERENCES public.lead_sources(id) ON DELETE SET NULL,
  default_deal_stage_id uuid REFERENCES public.deal_stages(id) ON DELETE SET NULL,
  default_assigned_to uuid REFERENCES public.organization_members(id) ON DELETE SET NULL,
  submission_count int NOT NULL DEFAULT 0,
  created_by uuid REFERENCES public.organization_members(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_forms_org ON public.forms(organization_id);
CREATE INDEX IF NOT EXISTS idx_forms_slug ON public.forms(slug);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.forms TO authenticated;
GRANT SELECT ON public.forms TO anon;
GRANT ALL ON public.forms TO service_role;

ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_forms_touch BEFORE UPDATE ON public.forms FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP POLICY IF EXISTS "org members manage forms" ON public.forms;
CREATE POLICY "org members manage forms" ON public.forms
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "public read active forms by slug" ON public.forms;
CREATE POLICY "public read active forms by slug" ON public.forms
  FOR SELECT TO anon, authenticated
  USING (is_active = true);


CREATE TABLE IF NOT EXISTS public.form_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  label text NOT NULL,
  field_type text NOT NULL DEFAULT 'text',
  placeholder text,
  help_text text,
  is_required boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  options jsonb DEFAULT '[]'::jsonb,
  map_to_lead_field text DEFAULT 'custom',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_form_fields_form ON public.form_fields(form_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_fields TO authenticated;
GRANT SELECT ON public.form_fields TO anon;
GRANT ALL ON public.form_fields TO service_role;

ALTER TABLE public.form_fields ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members manage form fields" ON public.form_fields;
CREATE POLICY "org members manage form fields" ON public.form_fields
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.forms f
      WHERE f.id = form_fields.form_id AND public.is_org_member(f.organization_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.forms f
      WHERE f.id = form_fields.form_id AND public.is_org_member(f.organization_id)
    )
  );

DROP POLICY IF EXISTS "public read active form fields" ON public.form_fields;
CREATE POLICY "public read active form fields" ON public.form_fields
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.forms f
      WHERE f.id = form_fields.form_id AND f.is_active = true
    )
  );


CREATE TABLE IF NOT EXISTS public.form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_form_submissions_form ON public.form_submissions(form_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_org ON public.form_submissions(organization_id);

GRANT SELECT, DELETE ON public.form_submissions TO authenticated;
GRANT INSERT ON public.form_submissions TO anon, authenticated;
GRANT ALL ON public.form_submissions TO service_role;

ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members view submissions" ON public.form_submissions;
CREATE POLICY "org members view submissions" ON public.form_submissions
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "org members delete submissions" ON public.form_submissions;
CREATE POLICY "org members delete submissions" ON public.form_submissions
  FOR DELETE TO authenticated
  USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "anyone can submit active form responses" ON public.form_submissions;
CREATE POLICY "anyone can submit active form responses" ON public.form_submissions
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.forms f
      WHERE f.id = form_submissions.form_id AND f.organization_id = form_submissions.organization_id AND f.is_active = true
    )
  );
