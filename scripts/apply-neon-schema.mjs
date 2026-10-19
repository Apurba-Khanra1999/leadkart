import pg from 'pg';
const { Client } = pg;

const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_LThWjFEK98Bs@ep-royal-snow-b4i5rtm5-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const client = new Client({ connectionString });

async function run() {
  await client.connect();
  console.log('Connected to Neon database successfully!');

  // Execute permissions, role_permissions, plans, seed, and policies
  const sql = `
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
  ('data.export','Data','Export data')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_permissions (role, permission_key)
SELECT 'owner'::public.app_role, key FROM public.permissions
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission_key)
SELECT 'admin'::public.app_role, key FROM public.permissions
WHERE key NOT IN ('billing.manage')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission_key) VALUES
  ('sales_manager','leads.view.all'),('sales_manager','leads.view.own'),('sales_manager','leads.create'),
  ('sales_manager','leads.update'),('sales_manager','leads.assign'),('sales_manager','leads.convert'),
  ('sales_manager','clients.view.all'),('sales_manager','clients.manage'),
  ('sales_manager','deals.view.all'),('sales_manager','deals.manage'),
  ('sales_manager','followups.view.all'),('sales_manager','followups.manage'),
  ('sales_manager','activities.create'),('sales_manager','quotations.view'),('sales_manager','quotations.manage'),
  ('sales_manager','invoices.view'),('sales_manager','payments.view'),
  ('sales_manager','reports.view.team'),('sales_manager','reports.view.own'),
  ('sales_manager','team.view'),('sales_manager','data.export')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission_key) VALUES
  ('sales_executive','leads.view.own'),('sales_executive','leads.create'),('sales_executive','leads.update'),
  ('sales_executive','clients.view.own'),('sales_executive','deals.view.own'),('sales_executive','deals.manage'),
  ('sales_executive','followups.view.own'),('sales_executive','followups.manage'),
  ('sales_executive','activities.create'),('sales_executive','quotations.view'),
  ('sales_executive','invoices.view'),('sales_executive','reports.view.own')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission_key) VALUES
  ('accountant','clients.view.all'),('accountant','deals.view.all'),
  ('accountant','quotations.view'),('accountant','quotations.manage'),
  ('accountant','invoices.view'),('accountant','invoices.manage'),
  ('accountant','payments.view'),('accountant','payments.record'),
  ('accountant','followups.view.all'),('accountant','followups.manage'),
  ('accountant','activities.create'),('accountant','reports.finance'),('accountant','data.export')
ON CONFLICT DO NOTHING;

INSERT INTO public.plans (code,name,description,price_monthly,max_users,max_leads,max_clients,features,sort_order) VALUES
  ('free','Free','Get started with the basics',0,2,100,50,'{"pipeline":true,"reports":false,"automations":false,"quotations":false,"invoices":false}',1),
  ('starter','Starter','For small sales teams',1499,5,1000,NULL,'{"pipeline":true,"reports":true,"automations":false,"quotations":true,"invoices":true}',2),
  ('professional','Professional','For growing sales organizations',3999,15,NULL,NULL,'{"pipeline":true,"reports":true,"automations":true,"quotations":true,"invoices":true,"advanced_permissions":true}',3),
  ('enterprise','Enterprise','Custom limits and priority support',0,NULL,NULL,NULL,'{"pipeline":true,"reports":true,"automations":true,"quotations":true,"invoices":true,"advanced_permissions":true,"priority_support":true}',4)
ON CONFLICT (code) DO NOTHING;

-- Enable RLS across all tables
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'organizations','profiles','teams','organization_members','permissions','role_permissions','plans','subscriptions',
    'audit_logs','lead_sources','lead_statuses','deal_stages','tags','clients','client_contacts',
    'leads','lead_tags','deals','follow_ups','activities','quotations','quotation_items',
    'invoices','invoice_items','payments','notifications','automation_rules','org_settings',
    'products','record_products','product_collections','forms','form_fields','form_submissions'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
  END LOOP;
END $$;

-- Drop and recreate RLS policies
DROP POLICY IF EXISTS "members read own org" ON public.organizations;
CREATE POLICY "members read own org" ON public.organizations
  FOR SELECT TO authenticated USING (public.is_org_member(id));
DROP POLICY IF EXISTS "authenticated can create org" ON public.organizations;
CREATE POLICY "authenticated can create org" ON public.organizations
  FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "org managers update org" ON public.organizations;
CREATE POLICY "org managers update org" ON public.organizations
  FOR UPDATE TO authenticated USING (public.has_perm(id,'org.manage')) WITH CHECK (public.has_perm(id,'org.manage'));

DROP POLICY IF EXISTS "read own profile" ON public.profiles;
CREATE POLICY "read own profile" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid());
DROP POLICY IF EXISTS "insert own profile" ON public.profiles;
CREATE POLICY "insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS "update own profile" ON public.profiles;
CREATE POLICY "update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "members read teams" ON public.teams;
CREATE POLICY "members read teams" ON public.teams
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
DROP POLICY IF EXISTS "team managers write teams" ON public.teams;
CREATE POLICY "team managers write teams" ON public.teams
  FOR ALL TO authenticated USING (public.has_perm(organization_id,'team.manage')) WITH CHECK (public.has_perm(organization_id,'team.manage'));

DROP POLICY IF EXISTS "members read members" ON public.organization_members;
CREATE POLICY "members read members" ON public.organization_members
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_org_member(organization_id));
DROP POLICY IF EXISTS "team managers add members" ON public.organization_members;
CREATE POLICY "team managers add members" ON public.organization_members
  FOR INSERT TO authenticated WITH CHECK (public.has_perm(organization_id,'team.manage'));
DROP POLICY IF EXISTS "team managers update members" ON public.organization_members;
CREATE POLICY "team managers update members" ON public.organization_members
  FOR UPDATE TO authenticated USING (public.has_perm(organization_id,'team.manage')) WITH CHECK (public.has_perm(organization_id,'team.manage'));
DROP POLICY IF EXISTS "team managers delete members" ON public.organization_members;
CREATE POLICY "team managers delete members" ON public.organization_members
  FOR DELETE TO authenticated
  USING (
    public.has_perm(organization_id, 'team.manage')
    AND id <> public.current_member_id(organization_id)
  );

DROP POLICY IF EXISTS "permissions readable by authenticated" ON public.permissions;
CREATE POLICY "permissions readable by authenticated" ON public.permissions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "role_permissions readable by authenticated" ON public.role_permissions;
CREATE POLICY "role_permissions readable by authenticated" ON public.role_permissions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "plans readable" ON public.plans;
CREATE POLICY "plans readable" ON public.plans FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "members read subscription" ON public.subscriptions;
CREATE POLICY "members read subscription" ON public.subscriptions
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
DROP POLICY IF EXISTS "billing manage subscription" ON public.subscriptions;
CREATE POLICY "billing manage subscription" ON public.subscriptions
  FOR ALL TO authenticated USING (public.has_perm(organization_id,'billing.manage')) WITH CHECK (public.has_perm(organization_id,'billing.manage'));

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['lead_sources','lead_statuses','deal_stages','tags','automation_rules','org_settings'] LOOP
    EXECUTE format($f$DROP POLICY IF EXISTS "%1$s_read" ON public.%1$I;$f$, t);
    EXECUTE format($f$CREATE POLICY "%1$s_read" ON public.%1$I FOR SELECT TO authenticated USING (public.is_org_member(organization_id));$f$, t);
    EXECUTE format($f$DROP POLICY IF EXISTS "%1$s_write" ON public.%1$I;$f$, t);
    EXECUTE format($f$CREATE POLICY "%1$s_write" ON public.%1$I FOR ALL TO authenticated USING (public.has_perm(organization_id,'settings.manage')) WITH CHECK (public.has_perm(organization_id,'settings.manage'));$f$, t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "leads_read" ON public.leads;
CREATE POLICY "leads_read" ON public.leads FOR SELECT TO authenticated USING (
  public.is_org_member(organization_id) AND (
    public.has_perm(organization_id,'leads.view.all')
    OR assigned_member_id = public.current_member_id(organization_id)
    OR created_by = public.current_member_id(organization_id)
  ));
DROP POLICY IF EXISTS "leads_insert" ON public.leads;
CREATE POLICY "leads_insert" ON public.leads FOR INSERT TO authenticated
  WITH CHECK (public.has_perm(organization_id,'leads.create'));
DROP POLICY IF EXISTS "leads_update" ON public.leads;
CREATE POLICY "leads_update" ON public.leads FOR UPDATE TO authenticated
  USING (public.has_perm(organization_id,'leads.update') AND (
    public.has_perm(organization_id,'leads.view.all')
    OR assigned_member_id = public.current_member_id(organization_id)))
  WITH CHECK (public.has_perm(organization_id,'leads.update'));
DROP POLICY IF EXISTS "leads_delete" ON public.leads;
CREATE POLICY "leads_delete" ON public.leads FOR DELETE TO authenticated
  USING (public.has_perm(organization_id,'leads.delete'));

DROP POLICY IF EXISTS "lead_tags_read" ON public.lead_tags;
CREATE POLICY "lead_tags_read" ON public.lead_tags FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
DROP POLICY IF EXISTS "lead_tags_write" ON public.lead_tags;
CREATE POLICY "lead_tags_write" ON public.lead_tags FOR ALL TO authenticated
  USING (public.has_perm(organization_id,'leads.update')) WITH CHECK (public.has_perm(organization_id,'leads.update'));

DROP POLICY IF EXISTS "clients_read" ON public.clients;
CREATE POLICY "clients_read" ON public.clients FOR SELECT TO authenticated USING (
  public.is_org_member(organization_id) AND (
    public.has_perm(organization_id,'clients.view.all')
    OR account_manager_id = public.current_member_id(organization_id)));
DROP POLICY IF EXISTS "clients_insert" ON public.clients;
CREATE POLICY "clients_insert" ON public.clients FOR INSERT TO authenticated
  WITH CHECK (public.has_perm(organization_id,'clients.manage'));
DROP POLICY IF EXISTS "clients_update" ON public.clients;
CREATE POLICY "clients_update" ON public.clients FOR UPDATE TO authenticated
  USING (public.has_perm(organization_id,'clients.manage')) WITH CHECK (public.has_perm(organization_id,'clients.manage'));
DROP POLICY IF EXISTS "clients_delete" ON public.clients;
CREATE POLICY "clients_delete" ON public.clients FOR DELETE TO authenticated
  USING (public.has_perm(organization_id,'clients.delete'));

DROP POLICY IF EXISTS "client_contacts_read" ON public.client_contacts;
CREATE POLICY "client_contacts_read" ON public.client_contacts FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
DROP POLICY IF EXISTS "client_contacts_write" ON public.client_contacts;
CREATE POLICY "client_contacts_write" ON public.client_contacts FOR ALL TO authenticated
  USING (public.has_perm(organization_id,'clients.manage')) WITH CHECK (public.has_perm(organization_id,'clients.manage'));

DROP POLICY IF EXISTS "deals_read" ON public.deals;
CREATE POLICY "deals_read" ON public.deals FOR SELECT TO authenticated USING (
  public.is_org_member(organization_id) AND (
    public.has_perm(organization_id,'deals.view.all')
    OR assigned_member_id = public.current_member_id(organization_id)));
DROP POLICY IF EXISTS "deals_insert" ON public.deals;
CREATE POLICY "deals_insert" ON public.deals FOR INSERT TO authenticated
  WITH CHECK (public.has_perm(organization_id,'deals.manage'));
DROP POLICY IF EXISTS "deals_update" ON public.deals;
CREATE POLICY "deals_update" ON public.deals FOR UPDATE TO authenticated
  USING (public.has_perm(organization_id,'deals.manage')) WITH CHECK (public.has_perm(organization_id,'deals.manage'));
DROP POLICY IF EXISTS "deals_delete" ON public.deals;
CREATE POLICY "deals_delete" ON public.deals FOR DELETE TO authenticated
  USING (public.has_perm(organization_id,'deals.delete'));

DROP POLICY IF EXISTS "fu_read" ON public.follow_ups;
CREATE POLICY "fu_read" ON public.follow_ups FOR SELECT TO authenticated USING (
  public.is_org_member(organization_id) AND (
    public.has_perm(organization_id,'followups.view.all')
    OR assigned_member_id = public.current_member_id(organization_id)));
DROP POLICY IF EXISTS "fu_write" ON public.follow_ups;
CREATE POLICY "fu_write" ON public.follow_ups FOR ALL TO authenticated
  USING (public.has_perm(organization_id,'followups.manage'))
  WITH CHECK (public.has_perm(organization_id,'followups.manage'));

DROP POLICY IF EXISTS "act_read" ON public.activities;
CREATE POLICY "act_read" ON public.activities FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
DROP POLICY IF EXISTS "act_insert" ON public.activities;
CREATE POLICY "act_insert" ON public.activities FOR INSERT TO authenticated
  WITH CHECK (public.has_perm(organization_id,'activities.create'));

DROP POLICY IF EXISTS "qt_read" ON public.quotations;
CREATE POLICY "qt_read" ON public.quotations FOR SELECT TO authenticated USING (public.has_perm(organization_id,'quotations.view'));
DROP POLICY IF EXISTS "qt_write" ON public.quotations;
CREATE POLICY "qt_write" ON public.quotations FOR ALL TO authenticated
  USING (public.has_perm(organization_id,'quotations.manage')) WITH CHECK (public.has_perm(organization_id,'quotations.manage'));
DROP POLICY IF EXISTS "qti_read" ON public.quotation_items;
CREATE POLICY "qti_read" ON public.quotation_items FOR SELECT TO authenticated USING (public.has_perm(organization_id,'quotations.view'));
DROP POLICY IF EXISTS "qti_write" ON public.quotation_items;
CREATE POLICY "qti_write" ON public.quotation_items FOR ALL TO authenticated
  USING (public.has_perm(organization_id,'quotations.manage')) WITH CHECK (public.has_perm(organization_id,'quotations.manage'));

DROP POLICY IF EXISTS "inv_read" ON public.invoices;
CREATE POLICY "inv_read" ON public.invoices FOR SELECT TO authenticated USING (public.has_perm(organization_id,'invoices.view'));
DROP POLICY IF EXISTS "inv_write" ON public.invoices;
CREATE POLICY "inv_write" ON public.invoices FOR ALL TO authenticated
  USING (public.has_perm(organization_id,'invoices.manage')) WITH CHECK (public.has_perm(organization_id,'invoices.manage'));
DROP POLICY IF EXISTS "invi_read" ON public.invoice_items;
CREATE POLICY "invi_read" ON public.invoice_items FOR SELECT TO authenticated USING (public.has_perm(organization_id,'invoices.view'));
DROP POLICY IF EXISTS "invi_write" ON public.invoice_items;
CREATE POLICY "invi_write" ON public.invoice_items FOR ALL TO authenticated
  USING (public.has_perm(organization_id,'invoices.manage')) WITH CHECK (public.has_perm(organization_id,'invoices.manage'));

DROP POLICY IF EXISTS "pay_read" ON public.payments;
CREATE POLICY "pay_read" ON public.payments FOR SELECT TO authenticated USING (public.has_perm(organization_id,'payments.view'));
DROP POLICY IF EXISTS "pay_write" ON public.payments;
CREATE POLICY "pay_write" ON public.payments FOR ALL TO authenticated
  USING (public.has_perm(organization_id,'payments.record')) WITH CHECK (public.has_perm(organization_id,'payments.record'));

DROP POLICY IF EXISTS "notif_read" ON public.notifications;
CREATE POLICY "notif_read" ON public.notifications FOR SELECT TO authenticated
  USING (member_id = public.current_member_id(organization_id));
DROP POLICY IF EXISTS "notif_update" ON public.notifications;
CREATE POLICY "notif_update" ON public.notifications FOR UPDATE TO authenticated
  USING (member_id = public.current_member_id(organization_id))
  WITH CHECK (member_id = public.current_member_id(organization_id));
DROP POLICY IF EXISTS "notif_insert" ON public.notifications;
CREATE POLICY "notif_insert" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id));

-- Products policies
DROP POLICY IF EXISTS "products_select_org" ON public.products;
CREATE POLICY "products_select_org" ON public.products
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
DROP POLICY IF EXISTS "products_insert" ON public.products;
CREATE POLICY "products_insert" ON public.products
  FOR INSERT TO authenticated WITH CHECK (public.has_perm(organization_id, 'settings.manage'));
DROP POLICY IF EXISTS "products_update" ON public.products;
CREATE POLICY "products_update" ON public.products
  FOR UPDATE TO authenticated USING (public.has_perm(organization_id, 'settings.manage'))
  WITH CHECK (public.has_perm(organization_id, 'settings.manage'));
DROP POLICY IF EXISTS "products_delete" ON public.products;
CREATE POLICY "products_delete" ON public.products
  FOR DELETE TO authenticated USING (public.has_perm(organization_id, 'settings.manage'));

DROP POLICY IF EXISTS "record_products_select_org" ON public.record_products;
CREATE POLICY "record_products_select_org" ON public.record_products
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
DROP POLICY IF EXISTS "record_products_insert" ON public.record_products;
CREATE POLICY "record_products_insert" ON public.record_products
  FOR INSERT TO authenticated WITH CHECK (public.has_perm(organization_id, 'leads.update'));
DROP POLICY IF EXISTS "record_products_update" ON public.record_products;
CREATE POLICY "record_products_update" ON public.record_products
  FOR UPDATE TO authenticated USING (public.has_perm(organization_id, 'leads.update'))
  WITH CHECK (public.has_perm(organization_id, 'leads.update'));
DROP POLICY IF EXISTS "record_products_delete" ON public.record_products;
CREATE POLICY "record_products_delete" ON public.record_products
  FOR DELETE TO authenticated USING (public.has_perm(organization_id, 'leads.update'));

-- Product collections policies
DROP POLICY IF EXISTS "product_collections_select_org" ON public.product_collections;
CREATE POLICY "product_collections_select_org" ON public.product_collections
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
DROP POLICY IF EXISTS "product_collections_manage" ON public.product_collections;
CREATE POLICY "product_collections_manage" ON public.product_collections
  FOR ALL TO authenticated USING (public.has_perm(organization_id, 'settings.manage'))
  WITH CHECK (public.has_perm(organization_id, 'settings.manage'));

-- Forms policies
DROP POLICY IF EXISTS "org members manage forms" ON public.forms;
CREATE POLICY "org members manage forms" ON public.forms
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "public read active forms by slug" ON public.forms;
CREATE POLICY "public read active forms by slug" ON public.forms
  FOR SELECT TO anonymous, authenticated
  USING (is_active = true);

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
  FOR SELECT TO anonymous, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.forms f
      WHERE f.id = form_fields.form_id AND f.is_active = true
    )
  );

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
  FOR INSERT TO anonymous, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.forms f
      WHERE f.id = form_submissions.form_id AND f.organization_id = form_submissions.organization_id AND f.is_active = true
    )
  );

-- Seed Demo Organisation with realistic leads, deals, followups, invoices if not already present
DO $$
DECLARE
  v_demo_org uuid;
  v_member_id uuid;
  v_source_web uuid;
  v_status_new uuid;
  v_stage_prop uuid;
BEGIN
  SELECT id INTO v_demo_org FROM public.organizations WHERE is_demo = true LIMIT 1;
  IF v_demo_org IS NULL THEN
    INSERT INTO public.organizations (name, slug, business_type, city, country, currency, currency_symbol, is_demo)
    VALUES ('Acme Corp Sales (Demo)', 'demo-workspace', 'B2B SaaS', 'Bengaluru', 'India', 'INR', '₹', true)
    RETURNING id INTO v_demo_org;

    INSERT INTO public.organization_members (organization_id, full_name, email, role, status, joined_at)
    VALUES (v_demo_org, 'Demo Admin', 'demo@leadkart.io', 'owner', 'active', now())
    RETURNING id INTO v_member_id;

    SELECT id INTO v_source_web FROM public.lead_sources WHERE organization_id = v_demo_org AND name = 'Website' LIMIT 1;
    SELECT id INTO v_status_new FROM public.lead_statuses WHERE organization_id = v_demo_org AND name = 'New' LIMIT 1;
    SELECT id INTO v_stage_prop FROM public.deal_stages WHERE organization_id = v_demo_org AND name = 'Proposal' LIMIT 1;

    -- Add demo products
    INSERT INTO public.products (organization_id, name, code, kind, unit_price, tax_percent, description)
    VALUES
      (v_demo_org, 'Enterprise CRM Suite (Annual)', 'PRD-001', 'service', 120000, 18, 'Annual enterprise license per seat'),
      (v_demo_org, 'Implementation & Onboarding', 'SRV-001', 'service', 35000, 18, 'Dedicated data migration and team training'),
      (v_demo_org, 'Custom API Integration Support', 'SRV-002', 'service', 25000, 18, 'Custom webhook and ERP pipeline integration');

    -- Add demo client
    INSERT INTO public.clients (organization_id, client_code, company_name, contact_person, phone, email, status, account_manager_id)
    VALUES (v_demo_org, 'CL-0001', 'Zenith Logistics Ltd', 'Vikram Malhotra', '+91 98765 43210', 'vikram@zenithlogistics.in', 'active', v_member_id);

    -- Add demo leads
    INSERT INTO public.leads (organization_id, lead_number, first_name, last_name, company, phone, email, source_id, status_id, priority, estimated_value, assigned_member_id, created_by)
    VALUES
      (v_demo_org, 'LD-0001', 'Rahul', 'Sharma', 'Apex Retail Solutions', '+91 98111 22334', 'rahul@apexretail.com', v_source_web, v_status_new, 'high', 250000, v_member_id, v_member_id),
      (v_demo_org, 'LD-0002', 'Priya', 'Nair', 'Horizon Healthcare', '+91 98222 33445', 'priya@horizonhealth.in', v_source_web, v_status_new, 'urgent', 500000, v_member_id, v_member_id),
      (v_demo_org, 'LD-0003', 'Ananya', 'Deshmukh', 'TechnoCraft Industries', '+91 98333 44556', 'ananya@technocraft.co', v_source_web, v_status_new, 'medium', 180000, v_member_id, v_member_id);

    -- Add demo deal
    INSERT INTO public.deals (organization_id, deal_number, name, stage_id, value, probability, status, priority, assigned_member_id)
    VALUES (v_demo_org, 'DL-0001', 'Zenith Logistics CRM Expansion', v_stage_prop, 450000, 60, 'open', 'high', v_member_id);

    -- Add demo follow-ups
    INSERT INTO public.follow_ups (organization_id, subject, type, due_at, priority, status, assigned_member_id, notes, meeting_link)
    VALUES
      (v_demo_org, 'Product Demo with Rahul Sharma', 'demo', now() + interval '2 hours', 'high', 'pending', v_member_id, 'Walkthrough of pipeline and quotation modules', 'https://meet.google.com/abc-defg-hij'),
      (v_demo_org, 'Follow-up Call with Priya Nair', 'call', now() + interval '1 day', 'urgent', 'pending', v_member_id, 'Review budget proposal and payment schedule', NULL);
  END IF;
END $$;
`;

  await client.query(sql);
  console.log('Neon database policies, seeds, and triggers created successfully!');
  await client.end();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
