-- L-Train Love — Full Supabase schema
-- Run in Supabase SQL Editor if starting fresh.
-- If check_ins/signals already exist, use docs/plan.md §8 instead.

-- ============================================================
-- 1. PROFILES TABLE (1:1 with auth.users)
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamp with time zone default now(),
  nickname text not null,
  description text
);

-- ============================================================
-- 2. CHECK_INS TABLE (create if not exists)
-- ============================================================
create table if not exists public.check_ins (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now(),
  station_id text not null,
  nickname text not null,
  description text,
  user_id uuid not null references auth.users(id) on delete cascade
);

-- ============================================================
-- 3. SIGNALS TABLE (create if not exists)
-- ============================================================
create table if not exists public.signals (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now(),
  from_user_id uuid not null references auth.users(id) on delete cascade,
  to_user_id uuid not null references auth.users(id) on delete cascade,
  station_id text not null,
  message text default '👋'
);

-- ============================================================
-- 4. INDEXES
-- ============================================================
create index if not exists check_ins_station_created_at_idx
  on public.check_ins (station_id, created_at desc);

create index if not exists signals_to_user_created_at_idx
  on public.signals (to_user_id, created_at desc);

-- ============================================================
-- 5. ENABLE REALTIME
-- ============================================================
alter publication supabase_realtime add table check_ins;
alter publication supabase_realtime add table signals;

-- ============================================================
-- 6. ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles enable row level security;
alter table public.check_ins enable row level security;
alter table public.signals enable row level security;

create policy "profiles_select_authed" on public.profiles for select to authenticated using (true);
create policy "profiles_insert_self" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "profiles_update_self" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "check_ins_select_authed" on public.check_ins for select to authenticated using (true);
create policy "check_ins_insert_self" on public.check_ins for insert to authenticated with check (user_id = auth.uid());

create policy "signals_insert_from_self" on public.signals for insert to authenticated with check (from_user_id = auth.uid());
create policy "signals_select_to_self" on public.signals for select to authenticated using (to_user_id = auth.uid());
