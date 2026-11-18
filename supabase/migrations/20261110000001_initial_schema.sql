-- ==============================================================================
-- 20261110000001_initial_schema.sql
-- Sudoku Contest Website: Initial Schema, Security, RLS & Private Storage Buckets
-- ==============================================================================

-- Enable UUID extension if not already available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 1. PROFILES TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    display_name TEXT,
    user_type TEXT NOT NULL CHECK (user_type IN ('book_buyer', 'free_player')),
    proof_status TEXT NOT NULL DEFAULT 'none' CHECK (proof_status IN ('none', 'pending', 'verified', 'rejected')),
    is_age_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Protect user_type and proof_status from client-side tampering
CREATE OR REPLACE FUNCTION public.protect_profile_status_columns()
RETURNS TRIGGER AS $$
BEGIN
    -- If executed by an authenticated user (not service_role), block alterations to protected fields
    IF (current_setting('request.jwt.claim.role', true) = 'authenticated') THEN
        IF NEW.user_type IS DISTINCT FROM OLD.user_type THEN
            RAISE EXCEPTION 'user_type is fixed and cannot be changed by the user';
        END IF;
        IF NEW.proof_status IS DISTINCT FROM OLD.proof_status THEN
            RAISE EXCEPTION 'proof_status can only be changed by system or administrator review';
        END IF;
    END IF;
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_profile_columns ON public.profiles;
CREATE TRIGGER trg_protect_profile_columns
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_profile_status_columns();

-- Automatic profile creation on auth.users signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    raw_user_type TEXT;
    raw_age_confirmed BOOLEAN;
    raw_display_name TEXT;
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 2. SETTINGS TABLE (Public-safe settings only)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 3. PROOFS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.proofs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    order_id TEXT NOT NULL,
    order_screenshot_path TEXT NOT NULL,
    book_photo_path TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
    rejection_reason TEXT,
    rejection_instructions TEXT,
    reviewed_at TIMESTAMPTZ,
    reviewed_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enforce order_id uniqueness ONLY among active (non-rejected) proofs
CREATE UNIQUE INDEX IF NOT EXISTS idx_proofs_unique_active_order_id
    ON public.proofs (lower(trim(order_id)))
    WHERE status != 'rejected';

-- Index for quick lookup of a user's proofs
CREATE INDEX IF NOT EXISTS idx_proofs_user_id ON public.proofs (user_id);

-- ==============================================================================
-- 4. PUZZLES TABLE (1 to 100)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.puzzles (
    id INTEGER PRIMARY KEY CHECK (id BETWEEN 1 AND 100),
    given_digits JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 5. OFFICIAL_SOLUTIONS TABLE (Admin only - zero public access)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.official_solutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    puzzle_id INTEGER NOT NULL UNIQUE REFERENCES public.puzzles(id) ON DELETE CASCADE,
    solution_digits JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 6. SUBMISSIONS TABLE (One active submission per user per puzzle)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    puzzle_id INTEGER NOT NULL REFERENCES public.puzzles(id) ON DELETE CASCADE,
    submitted_digits JSONB NOT NULL,
    photo_path TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_user_puzzle_submission UNIQUE (user_id, puzzle_id)
);

CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON public.submissions (user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_puzzle_id ON public.submissions (puzzle_id);

-- ==============================================================================
-- 7. SUBMISSION_HISTORY TABLE (Archived submissions when admin unlocks)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.submission_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_submission_id UUID,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    puzzle_id INTEGER NOT NULL REFERENCES public.puzzles(id) ON DELETE CASCADE,
    submitted_digits JSONB NOT NULL,
    photo_path TEXT,
    original_submitted_at TIMESTAMPTZ NOT NULL,
    unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    unlocked_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_submission_history_user_id ON public.submission_history (user_id);

-- ==============================================================================
-- 8. RESULTS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    puzzle_id INTEGER REFERENCES public.puzzles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    is_correct BOOLEAN NOT NULL DEFAULT FALSE,
    prize_type TEXT NOT NULL CHECK (prize_type IN ('per_puzzle', 'grand_prize')),
    prize_amount NUMERIC NOT NULL DEFAULT 0,
    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_results_user_id ON public.results (user_id);

-- ==============================================================================
-- 9. AUDIT_LOG TABLE (Admin action history)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_identifier TEXT NOT NULL,
    action TEXT NOT NULL,
    target_id TEXT,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log (created_at DESC);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS on ALL 9 tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.puzzles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.official_solutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- 1. profiles policies
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- 2. settings policies (public read-only)
DROP POLICY IF EXISTS "Anyone can read public settings" ON public.settings;
CREATE POLICY "Anyone can read public settings"
    ON public.settings FOR SELECT
    TO anon, authenticated
    USING (true);

-- 3. proofs policies (user can only read their own proofs; writes go through server routes)
DROP POLICY IF EXISTS "Users can read own proofs" ON public.proofs;
CREATE POLICY "Users can read own proofs"
    ON public.proofs FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- 4. puzzles policies (all users can view the given puzzle grids)
DROP POLICY IF EXISTS "Anyone can view puzzle grids" ON public.puzzles;
CREATE POLICY "Anyone can view puzzle grids"
    ON public.puzzles FOR SELECT
    TO anon, authenticated
    USING (true);

-- 5. official_solutions policies: ZERO POLICIES DEFINED!
-- Strict security: NO role (anon or authenticated) has SELECT/INSERT/UPDATE/DELETE.
-- Only Supabase service_role key bypasses RLS and can access this table.

-- 6. submissions policies (users can only read their own active submissions)
DROP POLICY IF EXISTS "Users can read own submissions" ON public.submissions;
CREATE POLICY "Users can read own submissions"
    ON public.submissions FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- 7. submission_history policies (users can only read their own history)
DROP POLICY IF EXISTS "Users can read own submission history" ON public.submission_history;
CREATE POLICY "Users can read own submission history"
    ON public.submission_history FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- 8. results policies (users can only read their own results IF published)
DROP POLICY IF EXISTS "Users can read own results when published" ON public.results;
CREATE POLICY "Users can read own results when published"
    ON public.results FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id AND is_published = TRUE);

-- 9. audit_log policies: ZERO POLICIES DEFINED!
-- Strict security: Only admin service_role can view or insert audit records.

-- ==============================================================================
-- STORAGE BUCKETS (Private - proofs & puzzle-photos)
-- ==============================================================================

-- Create buckets if they do not exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    (
        'proofs',
        'proofs',
        FALSE,
        5242880, -- 5 MB limit
        ARRAY['image/jpeg', 'image/png', 'application/pdf']
    ),
    (
        'puzzle-photos',
        'puzzle-photos',
        FALSE,
        5242880, -- 5 MB limit
        ARRAY['image/jpeg', 'image/png']
    )
ON CONFLICT (id) DO UPDATE SET
    public = FALSE,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS: Users can only download/view their own files via authenticated session
-- Path convention enforced: {bucket_id}/{user_id}/{filename}
DROP POLICY IF EXISTS "Users can view own proofs" ON storage.objects;
CREATE POLICY "Users can view own proofs"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'proofs' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can view own puzzle photos" ON storage.objects;
CREATE POLICY "Users can view own puzzle photos"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'puzzle-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Direct client uploads are disabled on storage.objects; uploads are routed through
-- server-side handlers that inspect binary magic bytes and file limits using the service role.

