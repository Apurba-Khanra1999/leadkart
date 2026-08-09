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