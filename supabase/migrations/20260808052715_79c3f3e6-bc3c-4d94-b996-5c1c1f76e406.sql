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