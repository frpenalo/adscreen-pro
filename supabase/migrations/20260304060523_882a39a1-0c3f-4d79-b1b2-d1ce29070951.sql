
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _role app_role;
BEGIN
  -- Only allow 'advertiser' or 'partner' from client metadata; never 'admin'
  _role := COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'advertiser');
  IF _role = 'admin' THEN
    _role := 'advertiser';
  END IF;

  INSERT INTO public.profiles (id, role, email)
  VALUES (NEW.id, _role, NEW.email);
  RETURN NEW;
END;
$function$;
