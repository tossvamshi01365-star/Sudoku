-- ==============================================================================
-- 20261111000001_add_profile_completed.sql
-- 1. Add profile_completed column to public.profiles
-- 2. Update default age_check_required setting to false (anyone can play; age verified at claim)
-- 3. Update handle_new_user: mark profile_completed = TRUE for email signups, FALSE for Google
-- 4. Update protect_profile_status_columns: allow setting user_type once while profile_completed is false;
--    permanently lock user_type once profile_completed is true; prevent profile_completed from resetting to false;
--    never allow user to alter proof_status.
-- ==============================================================================

-- 1. Add profile_completed column
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN NOT NULL DEFAULT FALSE;

-- Mark any existing profiles with valid user_type as completed
UPDATE public.profiles
SET profile_completed = TRUE
WHERE user_type IN ('book_buyer', 'free_player');

-- 2. Update age_check_required in settings to false by default
UPDATE public.settings
SET value = 'false'::jsonb
WHERE key = 'age_check_required';

-- 3. Recreate handle_new_user to distinguish email signup vs Google OAuth
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
    is_completed boolean;
BEGIN
    raw_user_type := NEW.raw_user_meta_data->>'user_type';
    raw_age_confirmed := COALESCE((NEW.raw_user_meta_data->>'is_age_confirmed')::boolean, false);
    
    -- Fallback to Google's name or full_name if display_name was not provided
    raw_display_name := COALESCE(
        NEW.raw_user_meta_data->>'display_name',
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name'
    );

    -- If user_type was explicitly chosen at signup (email/password form), profile is complete.
    -- If created via Google OAuth (no user_type metadata), profile is incomplete.
    IF raw_user_type IN ('book_buyer', 'free_player') THEN
        is_completed := TRUE;
    ELSE
        raw_user_type := 'free_player'; -- placeholder until /complete-profile is submitted
        is_completed := FALSE;
    END IF;

    INSERT INTO public.profiles (
        id,
        email,
        display_name,
        user_type,
        proof_status,
        is_age_confirmed,
        profile_completed
    )
    VALUES (
        NEW.id,
        NEW.email,
        raw_display_name,
        raw_user_type,
        'none',
        raw_age_confirmed,
        is_completed
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$;

-- 4. Recreate protect_profile_status_columns with single-completion enforcement
CREATE OR REPLACE FUNCTION public.protect_profile_status_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- Detect a normal logged-in user via auth.uid() IS NOT NULL.
    -- Admin tasks and service role background functions bypass this check.
    IF (auth.uid() IS NOT NULL) THEN
        -- Rule 1: proof_status can NEVER be modified by the user
        IF NEW.proof_status IS DISTINCT FROM OLD.proof_status THEN
            RAISE EXCEPTION 'proof_status can only be changed by system or administrator review';
        END IF;

        -- Rule 2: If profile was already completed, user_type is permanently locked
        IF OLD.profile_completed = TRUE THEN
            IF NEW.user_type IS DISTINCT FROM OLD.user_type THEN
                RAISE EXCEPTION 'user_type is locked and cannot be changed';
            END IF;

            -- Rule 3: profile_completed can NEVER be reset back to false
            IF NEW.profile_completed = FALSE THEN
                RAISE EXCEPTION 'profile_completed cannot be reset to false';
            END IF;
        END IF;

        -- Rule 4: If profile is not yet completed, user_type can only be set to valid values
        IF OLD.profile_completed = FALSE AND NEW.user_type NOT IN ('book_buyer', 'free_player') THEN
            RAISE EXCEPTION 'Invalid user_type. Must be book_buyer or free_player';
        END IF;
    END IF;

    NEW.updated_at = pg_catalog.now();
    RETURN NEW;
END;
$$;

-- 5. Revoke direct execute from client roles
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_profile_status_columns() FROM PUBLIC, anon, authenticated;

