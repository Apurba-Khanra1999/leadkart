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