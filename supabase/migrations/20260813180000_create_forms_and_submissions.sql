-- =====================================================================
-- Migration: Dynamic Forms, Form Fields, and Form Submissions
-- =====================================================================

-- 1. Create FORMS table
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

-- Policies for forms
DROP POLICY IF EXISTS "org members manage forms" ON public.forms;
CREATE POLICY "org members manage forms" ON public.forms
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "public read active forms by slug" ON public.forms;
CREATE POLICY "public read active forms by slug" ON public.forms
  FOR SELECT TO anon, authenticated
  USING (is_active = true);


-- 2. Create FORM_FIELDS table
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

-- Policies for form_fields
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


-- 3. Create FORM_SUBMISSIONS table
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

-- Policies for form_submissions
DROP POLICY IF EXISTS "org members view and delete submissions" ON public.form_submissions;
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
