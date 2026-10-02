-- ==============================================================================
-- KOLKATA RUNNERS CLUB — INITIAL SCHEMA & ROW LEVEL SECURITY (RLS)
-- Supabase PostgreSQL Migration
-- Date: October 2026
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ENUMS
DO $$ BEGIN
    CREATE TYPE member_role AS ENUM ('MEMBER', 'ADMIN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE member_status AS ENUM ('active', 'suspended', 'removed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE distance_goal_group AS ENUM ('up_to_50', 'up_to_75', 'above_100');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. PROFILES TABLE (Linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    role member_role NOT NULL DEFAULT 'MEMBER',
    status member_status NOT NULL DEFAULT 'active',
    bio TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. CLUBS TABLE (One seeded club)
CREATE TABLE IF NOT EXISTS public.clubs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    image_url TEXT NOT NULL,
    announcement TEXT,
    location TEXT NOT NULL DEFAULT 'Kolkata, India',
    founded_year INT NOT NULL DEFAULT 2021,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. CLUB MEMBERSHIPS TABLE
CREATE TABLE IF NOT EXISTS public.club_memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role member_role NOT NULL DEFAULT 'MEMBER',
    status member_status NOT NULL DEFAULT 'active',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(club_id, user_id)
);

-- 6. MONTHLY GOALS TABLE (Stable monthly goal category assignments)
CREATE TABLE IF NOT EXISTS public.monthly_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    month_key TEXT NOT NULL, -- e.g. "2026-10"
    goal_group distance_goal_group NOT NULL DEFAULT 'up_to_50',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(user_id, month_key)
);

-- 7. STRAVA CONNECTIONS TABLE (Server-only credentials, strict isolation)
CREATE TABLE IF NOT EXISTS public.strava_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    athlete_id BIGINT NOT NULL,
    athlete_name TEXT NOT NULL,
    athlete_avatar TEXT,
    access_token TEXT NOT NULL, -- encrypted or server-only
    refresh_token TEXT,
    expires_at BIGINT,
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 8. ACTIVITIES TABLE (Authoritative running records)
CREATE TABLE IF NOT EXISTS public.activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    strava_activity_id TEXT NOT NULL,
    member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    athlete_id BIGINT,
    title TEXT NOT NULL,
    sport_type TEXT NOT NULL DEFAULT 'Run', -- Run, TrailRun, VirtualRun
    distance_meters NUMERIC NOT NULL DEFAULT 0,
    moving_time_seconds INT NOT NULL DEFAULT 0,
    elapsed_time_seconds INT NOT NULL DEFAULT 0,
    start_date_local TIMESTAMPTZ NOT NULL,
    start_date_timestamp BIGINT NOT NULL,
    manual BOOLEAN NOT NULL DEFAULT FALSE,
    visibility TEXT NOT NULL DEFAULT 'everyone',
    is_excluded BOOLEAN NOT NULL DEFAULT FALSE,
    exclusion_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(member_id, strava_activity_id)
);

-- 9. INDEXES FOR HIGH-PERFORMANCE LEADERBOARD QUERIES
CREATE INDEX IF NOT EXISTS idx_activities_member_date ON public.activities(member_id, start_date_local);
CREATE INDEX IF NOT EXISTS idx_activities_excluded ON public.activities(is_excluded);
CREATE INDEX IF NOT EXISTS idx_activities_sport ON public.activities(sport_type);
CREATE INDEX IF NOT EXISTS idx_monthly_goals_lookup ON public.monthly_goals(month_key, goal_group);
CREATE INDEX IF NOT EXISTS idx_profiles_status_role ON public.profiles(status, role);

-- 10. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strava_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- Helper function: Is Admin?
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'ADMIN'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profiles Policies
CREATE POLICY "Public profiles are viewable by authenticated users"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can update own display name and bio"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
    auth.uid() = id
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid()) -- disallow role elevation
    AND status = (SELECT status FROM public.profiles WHERE id = auth.uid()) -- disallow un-suspension
);

CREATE POLICY "Admins can update any profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (public.is_admin());

-- Clubs Policies
CREATE POLICY "Clubs viewable by anyone"
ON public.clubs FOR SELECT
TO authenticated, anon
USING (true);

CREATE POLICY "Admins can update club info"
ON public.clubs FOR UPDATE
TO authenticated
USING (public.is_admin());

-- Club Memberships Policies
CREATE POLICY "Memberships viewable by authenticated users"
ON public.club_memberships FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can join as MEMBER"
ON public.club_memberships FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = user_id
    AND role = 'MEMBER' -- Strictly enforce MEMBER role on join
    AND status = 'active'
);

CREATE POLICY "Admins can update membership status and role"
ON public.club_memberships FOR UPDATE
TO authenticated
USING (public.is_admin());

-- Monthly Goals Policies
CREATE POLICY "Monthly goals viewable by all members"
ON public.monthly_goals FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can set their own monthly goals"
ON public.monthly_goals FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own monthly goals"
ON public.monthly_goals FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Strava Connections Policies (Server only access, credentials isolated)
-- Do NOT grant SELECT to authenticated role for tokens!
CREATE POLICY "Service role full access to strava_connections"
ON public.strava_connections FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Activities Policies
CREATE POLICY "Activities viewable by authenticated members"
ON public.activities FOR SELECT
TO authenticated
USING (
    visibility = 'everyone'
    OR (auth.uid() = member_id)
);

CREATE POLICY "Members can insert their own activities"
ON public.activities FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = member_id
    AND is_excluded = FALSE -- members cannot self-unexclude
);

CREATE POLICY "Admins can update activity exclusion"
ON public.activities FOR UPDATE
TO authenticated
USING (public.is_admin());

-- 11. TRIGGER: Automatically create profile on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, display_name, avatar_url, role, status)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', 'https://api.dicebear.com/7.x/bottts/svg?seed=' || encode(digest(NEW.id::text, 'sha256'), 'hex')),
        'MEMBER',
        'active'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 12. SEED THE DEFAULT CLUB
INSERT INTO public.clubs (slug, name, description, image_url, announcement, location, founded_year)
VALUES (
    'kolkata-runners-club',
    'Kolkata Runners Club',
    'Running together across the City of Joy — Rabindra Sarobar, Maidan, Victoria Memorial & Salt Lake.',
    'https://images.unsplash.com/photo-1452626038306-9aae5e071dd3?auto=format&fit=crop&w=1200&q=80',
    'Welcome to October 2026 challenge! Connect Strava to sync runs. Monthly distance & pace leaderboards now active.',
    'Kolkata, India',
    2021
)
ON CONFLICT (slug) DO NOTHING;
