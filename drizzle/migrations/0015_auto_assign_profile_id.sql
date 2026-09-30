CREATE OR REPLACE FUNCTION internal.assign_profile_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_prefix text := ''; v_start int := 1; v_digits int := 4; v_next int;
BEGIN
  IF NEW.profile_id IS NOT NULL AND NEW.profile_id <> '' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.company_id IS NOT DISTINCT FROM OLD.company_id AND OLD.profile_id IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.company_id IS NULL THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('profile_id:' || NEW.company_id::text));
  SELECT COALESCE(prefix,''), COALESCE(starting_number,1), COALESCE(num_digits,4)
    INTO v_prefix, v_start, v_digits
    FROM document_id_config WHERE company_id = NEW.company_id AND document_type = 'profile';
  IF NOT FOUND THEN v_prefix := ''; v_start := 1; v_digits := 4; END IF;
  SELECT COALESCE(MAX(CASE WHEN profile_id ~ ('^' || v_prefix || '[0-9]+$')
      THEN CAST(SUBSTRING(profile_id FROM LENGTH(v_prefix) + 1) AS INTEGER) ELSE 0 END), v_start - 1) + 1
    INTO v_next FROM profiles WHERE company_id = NEW.company_id AND id IS DISTINCT FROM NEW.id;
  IF v_next < v_start THEN v_next := v_start; END IF;
  NEW.profile_id := v_prefix || LPAD(v_next::text, v_digits, '0');
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS assign_profile_id_trg ON public.profiles;
CREATE TRIGGER assign_profile_id_trg BEFORE INSERT OR UPDATE OF company_id, profile_id ON public.profiles
FOR EACH ROW EXECUTE FUNCTION internal.assign_profile_id();

DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT id FROM public.profiles WHERE profile_id IS NULL OR profile_id = '' ORDER BY created_at LOOP
    UPDATE public.profiles SET profile_id = NULL WHERE id = r.id;
  END LOOP;
END $$;