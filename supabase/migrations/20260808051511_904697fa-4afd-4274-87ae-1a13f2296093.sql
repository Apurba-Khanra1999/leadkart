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