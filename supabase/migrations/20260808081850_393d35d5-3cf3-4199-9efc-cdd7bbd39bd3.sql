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