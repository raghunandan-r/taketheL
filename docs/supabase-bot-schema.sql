-- L-Train Bot Bridge Schema
-- Run this in Supabase SQL Editor

-- 1. Add interests to profiles (if not already exists)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS interests text[] DEFAULT ARRAY[]::text[];

CREATE INDEX IF NOT EXISTS profiles_interests_idx ON public.profiles USING GIN(interests);

-- 2. Bot sessions: who's online where
CREATE TABLE IF NOT EXISTS public.bot_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  station_id text NOT NULL,
  last_heartbeat timestamptz DEFAULT now(),
  CONSTRAINT one_session_per_user UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS bot_sessions_station_idx ON public.bot_sessions (station_id);
CREATE INDEX IF NOT EXISTS bot_sessions_heartbeat_idx ON public.bot_sessions (last_heartbeat);

ALTER TABLE public.bot_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bot_sessions_own" ON public.bot_sessions FOR ALL TO authenticated USING (user_id = auth.uid());

-- 3. Matches: proposed meetups (with idempotency key)
CREATE TABLE IF NOT EXISTS public.matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  user_a_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  station_id text NOT NULL,
  meeting_station text,
  venue_name text,
  idempotency_key text UNIQUE,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired'))
);

CREATE INDEX IF NOT EXISTS matches_user_a_idx ON public.matches (user_a_id);
CREATE INDEX IF NOT EXISTS matches_user_b_idx ON public.matches (user_b_id);
CREATE INDEX IF NOT EXISTS matches_idempotency_idx ON public.matches (idempotency_key);

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "matches_own" ON public.matches FOR ALL TO authenticated USING (user_a_id = auth.uid() OR user_b_id = auth.uid());

-- 4. Cleanup functions
CREATE OR REPLACE FUNCTION cleanup_stale_sessions() RETURNS void AS $$
BEGIN
  DELETE FROM public.bot_sessions WHERE last_heartbeat < NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION cleanup_expired_matches() RETURNS void AS $$
BEGIN
  DELETE FROM public.matches WHERE status = 'pending' AND created_at < NOW() - INTERVAL '10 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
