-- ==============================================================================
-- 20261110000002_fix_function_security.sql
-- Security Hardening for Trigger Functions:
-- 1. Explicit empty search_path (SET search_path = '') to eliminate search-path injection
-- 2. Fully schema-qualified object references (public.profiles, auth.uid(), pg_catalog.*)
-- 3. Robust user detection via auth.uid() IS NOT NULL to protect status columns
-- 4. Revocation of direct EXECUTE privilege from PUBLIC, anon, and authenticated
-- ==============================================================================

-- 1. Recreate protect_profile_status_columns with security hardening
CREATE OR REPLACE FUNCTION public.protect_profile_status_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- Detect a normal logged-in user via auth.uid() IS NOT NULL.
    -- Admin actions and server tasks running under service_role have no user ID.
    IF (auth.uid() IS NOT NULL) THEN
        IF NEW.user_type IS DISTINCT FROM OLD.user_type THEN
            RAISE EXCEPTION 'user_type is fixed and cannot be changed by the user';
        END IF;
        IF NEW.proof_status IS DISTINCT FROM OLD.proof_status THEN
            RAISE EXCEPTION 'proof_status can only be changed by system or administrator review';
        END IF;
    END IF;

    NEW.updated_at = pg_catalog.now();
    RETURN NEW;
END;
$$;

-- 2. Recreate handle_new_user with security hardening
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    raw_user_type text;
    raw_age_confirmed boolean;
    raw_display_name text;
BEGIN
    raw_user_type := COALESCE(NEW.raw_user_meta_data->>'user_type', 'free_player');
    IF raw_user_type NOT IN ('book_buyer', 'free_player') THEN
        raw_user_type := 'free_player';
    END IF;

    raw_age_confirmed := COALESCE((NEW.raw_user_meta_data->>'is_age_confirmed')::boolean, false);
    raw_display_name := NEW.raw_user_meta_data->>'display_name';

    INSERT INTO public.profiles (id, email, display_name, user_type, proof_status, is_age_confirmed)
    VALUES (
        NEW.id,
        NEW.email,
        raw_display_name,
        raw_user_type,
        'none',
        raw_age_confirmed
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$;

-- 3. Revoke direct EXECUTE access from PUBLIC, anon, and authenticated
-- (These functions should only ever execute via system triggers)
REVOKE EXECUTE ON FUNCTION public.protect_profile_status_columns() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.protect_profile_status_columns() FROM anon;
REVOKE EXECUTE ON FUNCTION public.protect_profile_status_columns() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;

