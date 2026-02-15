# L-Train Love (MVP) — Build Plan (Repo-Mapped)

This document is a **build-executable plan** tailored to the existing codebase at the project root (Next.js 16 App Router + Tailwind + shadcn/ui + v0-imported components). It replaces the current "SubwayMatch" swipe mock with a realtime serendipity app for NYC L-train commuters.

**Three "Must-Have" services:**
1. **Station Lobby**: manual check-in that expires after 20 minutes (via query filtering, not cron).
2. **Live Presence**: see who's at the same station right now.
3. **Signal / Wave**: realtime "someone wants to talk" notification + meetup suggestion.

---

## Constraints (hard)
- **Mobile-first only**: design for **390px** width (no desktop layouts).
- **No GPS**: station chosen from a hardcoded L-train dropdown.
- **Realtime only**: Supabase Realtime (postgres\_changes) + Presence/Broadcast.
- **Ephemeral**: show only the last **20 minutes** of check-ins (no cron jobs, no deletions).
- **No image uploads**: text-based physical descriptions only.
- **Auth**: Supabase Auth (**email + password**). Session persisted via cookies (`@supabase/ssr`).

---

## Prerequisites (for agents and environments)

**Required packages (install before implementing):**

```bash
pnpm add @supabase/supabase-js @supabase/ssr
```

(Use `npm install` or `yarn add` if the project does not use pnpm; this repo has `pnpm-lock.yaml` so prefer `pnpm add`.)

**Environment variables** (not committed; create `.env.local` or set in your environment):

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL (e.g. `https://your-project.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key from project API settings |

- **Cursor / dev environments**: Run the install command above in the project root. Set the two env vars in your environment (e.g. Cursor Environment secrets, `.env.local`, or your host’s env). No other system packages or global tools are required.

---

## 0) Current Repo Snapshot (what we already have)

| What | Where | Notes |
|------|-------|-------|
| Next.js App Router | `app/page.tsx`, `app/layout.tsx` | v16, App Router |
| Tailwind + CSS variables | `app/globals.css`, `tailwind.config.ts` | HSL-based design tokens |
| shadcn/ui | `components/ui/*` (58 files) | Full component library already installed |
| Theme provider | `components/theme-provider.tsx` | Wraps `next-themes` |
| Toast (sonner) | `components/ui/sonner.tsx` | Ready to use, not yet rendered in layout |
| Toast (radix) | `components/ui/toaster.tsx`, `components/ui/use-toast.ts` | Alternative; prefer sonner for simplicity |
| v0 swipe UI | `components/subway-header.tsx`, `components/profile-card.tsx`, `components/swipe-buttons.tsx`, `components/match-overlay.tsx`, `components/matches-view.tsx`, `components/profile-view.tsx` | Will be retired |
| Mock profile data | `lib/profiles.ts` | Will be retired (rename-collision risk with new `lib/profile.ts`) |
| Utility | `lib/utils.ts` | `cn()` helper |

**Key implication**: the app shell patterns (max-width mobile container, sticky header, card look/feel, lucide icons) are already good. We **swap the feature content** behind those patterns.

---

## 1) Auth Flow (Email + Password — Supabase Auth)

This section describes the **complete** auth flow aligned with [Vercel's recommended Supabase integration](https://supabase.com/docs/guides/auth/server-side/nextjs).

### 1.1 How it works (overview)

1. Unauthenticated user visits `/` → middleware redirects to `/auth/login`.
2. User signs up at `/auth/sign-up` → Supabase sends a confirmation email.
3. User clicks email link → hits `/auth/callback` route handler → exchanges code for session → redirects to `/`.
4. Authenticated user visits `/` → server component reads session from cookies → renders the app.
5. User signs out → `supabase.auth.signOut()` → redirect to `/auth/login`.

### 1.2 Sign up

- User opens `/auth/sign-up`.
- User enters email + password + nickname.
- Client calls:
  ```ts
  supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  })
  ```
- On success, redirect to `/auth/sign-up-success` ("Check your email").
- **Important**: the `emailRedirectTo` URL **must** point to `/auth/callback` so the confirmation link works.

### 1.3 Email confirmation callback

- Supabase appends a `code` query param to the redirect URL.
- The route handler at `app/auth/callback/route.ts`:
  1. Reads `code` from the URL search params.
  2. Calls `supabase.auth.exchangeCodeForSession(code)`.
  3. On success, redirects to `/`.
  4. On failure, redirects to `/auth/error`.

### 1.4 Sign in

- User opens `/auth/login`.
- User enters email + password.
- Client calls `supabase.auth.signInWithPassword({ email, password })`.
- On success, redirect to `/` (via `router.push("/")`).

### 1.5 Gate the app (session check)

- `middleware.ts` (project root):
  - On every request, call `lib/supabase/middleware.ts` helper to refresh auth tokens + set cookies.
  - If the request path is NOT under `/auth/*` and there is no valid session, redirect to `/auth/login`.
  - If the request path IS under `/auth/*` and there IS a valid session, redirect to `/` (prevent logged-in users from seeing login page).
- `app/page.tsx`:
  - This becomes a **server component** (remove `"use client"`).
  - Read the session using the server Supabase client.
  - If no session: `redirect("/auth/login")` (belt-and-suspenders; middleware should have caught this).
  - If session exists: render the app shell client component, passing `user.id` as a prop.

### 1.6 Sign out

- "Me" tab or header shows **Sign out** button.
- On click:
  ```ts
  await supabase.auth.signOut()
  router.push("/auth/login")
  ```

### 1.7 Profile creation (on first login)

- After sign-up confirmation + first redirect to `/`, ensure a `profiles` row exists.
- Recommended approach: in the server component (`app/page.tsx`), after reading the session, call `getOrCreateProfile(supabase, user)` from `lib/profile.ts`.
- This function does an **upsert**: `INSERT INTO profiles (id, nickname) VALUES (auth.uid(), email_prefix) ON CONFLICT (id) DO NOTHING`.

---

## 2) Proposed UX / Navigation (mapped to existing `SubwayHeader`)

### Navigation tabs
Repurpose existing header tabs from **Discover / Matches / Profile** to:

| Tab ID | Label | Icon (lucide) |
|--------|-------|----------------|
| `lobby` | Lobby | `Train` |
| `waves` | Waves | `Bell` or `Hand` |
| `me` | Me | `User` |

- Update `components/subway-header.tsx`: change tab IDs, labels, icons.
- Update app title from "SubwayMatch" to "L-Train Love".

### Core screens

**Lobby tab**
- Station dropdown (hardcoded L-line stations from `lib/stations.ts`).
- "Check in" form: nickname (prefilled from `profiles.nickname`) + description (text area) + CTA **"Check in (20 min)"**.
- Live list: each entry shows nickname + description + "At the platform" + relative time.
- Action: **Wave** button on each entry (hidden for yourself).

**Waves tab**
- List of waves received (from `signals` table, last 20 minutes).
- Each wave: "Someone waved at you at [Station]" + suggestion **"Meet at the clock/turnstile"**.

**Me tab**
- Edit nickname (updates `profiles.nickname` via Supabase).
- **Sign out** button.

---

## 3) Data Architecture (Supabase)

### 3.1 Tables (auth-aware)

Supabase provides `auth.users` automatically. We add one app table + reference `auth.users(id)` from the existing tables.

**`profiles`** (new)
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | PK, references `auth.users(id) on delete cascade` |
| `created_at` | `timestamptz` | default `now()` |
| `nickname` | `text` | not null |
| `description` | `text` | nullable |

**`check_ins`** (existing, updated)
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `created_at` | `timestamptz` | default `now()` |
| `station_id` | `text` | not null |
| `nickname` | `text` | not null (denormalized from profiles — intentional; check-ins expire in 20m so stale nicknames are not a problem) |
| `description` | `text` | nullable |
| `user_id` | `uuid` | not null, FK to `auth.users(id)` |

**`signals`** (existing, updated)
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `created_at` | `timestamptz` | default `now()` |
| `from_user_id` | `uuid` | not null, FK to `auth.users(id)` |
| `to_user_id` | `uuid` | not null, FK to `auth.users(id)` |
| `station_id` | `text` | not null |
| `message` | `text` | default `'👋'` |

### 3.2 Indexes

```sql
create index if not exists check_ins_station_created_at_idx
  on public.check_ins (station_id, created_at desc);

create index if not exists signals_to_user_created_at_idx
  on public.signals (to_user_id, created_at desc);
```

### 3.3 Realtime

```sql
alter publication supabase_realtime add table check_ins;
alter publication supabase_realtime add table signals;
```

### 3.4 RLS Policies

With Supabase Auth, RLS governs both direct queries **and** realtime subscriptions (the client only receives postgres\_changes events for rows it can `select`).

**`profiles`**
| Operation | Policy | Rule |
|-----------|--------|------|
| `select` | `profiles_select_authed` | `to authenticated using (true)` |
| `insert` | `profiles_insert_self` | `to authenticated with check (id = auth.uid())` |
| `update` | `profiles_update_self` | `to authenticated using (id = auth.uid()) with check (id = auth.uid())` |

**`check_ins`**
| Operation | Policy | Rule |
|-----------|--------|------|
| `select` | `check_ins_select_authed` | `to authenticated using (true)` |
| `insert` | `check_ins_insert_self` | `to authenticated with check (user_id = auth.uid())` |

No `update` or `delete` policies in MVP.

**`signals`**
| Operation | Policy | Rule |
|-----------|--------|------|
| `insert` | `signals_insert_from_self` | `to authenticated with check (from_user_id = auth.uid())` |
| `select` | `signals_select_to_self` | `to authenticated using (to_user_id = auth.uid())` |

**Implication for realtime**: because `signals` has a restrictive `select` policy (`to_user_id = auth.uid()`), the realtime subscription on `signals` will **automatically** only deliver events addressed to the current user. You do **not** need client-side filtering for signals — RLS handles it server-side.

For `check_ins`, the `select` policy is open to all authenticated users, so the client **does** need to filter by `station_id` and `created_at > now - 20m` client-side on the realtime payload.

### 3.5 "Ephemeral" logic (no cron)
We **never delete rows**. We only show rows matching `created_at > now() - interval '20 minutes'`, enforced in:
- **Select queries** (SQL `.gt('created_at', twentyMinutesAgo)`).
- **Realtime payload handling** (client ignores payloads with old timestamps).

---

## 4) Realtime Architecture

### 4.1 Check-ins (live lobby)
- Initial fetch: `station_id = current`, `created_at > now-20m`, order `created_at desc`.
- Subscribe to `postgres_changes` INSERT on `check_ins`.
- On payload: if `station_id !== current` → ignore. If `created_at` older than 20m → ignore. Else prepend (dedupe by `id`).

### 4.2 Presence (who is here "right now")
- Channel: `presence:station:${station_id}`.
- Track: `{ user_id, nickname }`.
- UI: "X people here now" indicator at top of lobby list.
- Fallback: derive from count of recent check-ins if Presence is flaky.

### 4.3 Waves (signals)
- Subscribe to `postgres_changes` INSERT on `signals`.
- RLS ensures only events where `to_user_id = auth.uid()` are delivered.
- On payload: show toast "Someone waved at you!" + meetup suggestion.

---

## 5) Frontend Architecture (files, components, responsibilities)

### 5.1 Dependencies

See **Prerequisites** (above) for install command and env vars. Summary:

- **Install:** `pnpm add @supabase/supabase-js @supabase/ssr` (or `npm install` / `yarn add`).
- **Env:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local` or your environment.

### 5.2 Complete File Plan

Below is every file that must be **created** or **updated**, grouped by category, with exact paths and responsibilities.

#### Supabase Client Setup (3 files — create all)

| File | Purpose | Key export(s) |
|------|---------|---------------|
| `lib/supabase/client.ts` | Browser-side Supabase client. Used in **client components** only. | `createClient()` — calls `createBrowserClient(url, anonKey)` from `@supabase/ssr`. |
| `lib/supabase/server.ts` | Server-side Supabase client. Used in **server components**, **route handlers**, and **server actions**. | `createClient()` — calls `createServerClient(url, anonKey, { cookies })` from `@supabase/ssr`. Reads/writes cookies via `next/headers`. |
| `lib/supabase/middleware.ts` | Middleware helper that refreshes auth tokens and sets updated cookies on every request. | `updateSession(request)` — creates a server client, calls `supabase.auth.getUser()` to refresh the session, returns `NextResponse` with updated cookies. |

**Implementation notes for `lib/supabase/middleware.ts`:**
- This file creates a Supabase client using `createServerClient` with custom cookie get/set/remove handlers that operate on the `NextRequest`/`NextResponse`.
- It calls `supabase.auth.getUser()` (not `getSession()` — `getUser()` forces a server-side token refresh).
- It returns the `NextResponse` with any updated `Set-Cookie` headers.

#### Root Middleware (1 file — create)

| File | Purpose |
|------|---------|
| `middleware.ts` | Next.js middleware at project root. Calls `updateSession()` from `lib/supabase/middleware.ts`. Contains route-protection logic. |

**Behavior:**
1. Call `updateSession(request)` to refresh cookies on every request.
2. Read the user from the refreshed response.
3. If the path does NOT start with `/auth` AND there is no user → redirect to `/auth/login`.
4. If the path starts with `/auth` AND there IS a user → redirect to `/` (prevent double-login).
5. Return the response.

**`matcher` config:**
```ts
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image, favicon.ico, and common static extensions
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
```

#### Auth Pages (4 pages + 1 route handler — create all)

| File | Type | Purpose |
|------|------|---------|
| `app/auth/login/page.tsx` | Client component (`"use client"`) | Email + password login form. On success: `router.push("/")`. |
| `app/auth/sign-up/page.tsx` | Client component (`"use client"`) | Registration form. Calls `signUp()` with `emailRedirectTo` set to `${origin}/auth/callback`. On success: `router.push("/auth/sign-up-success")`. |
| `app/auth/sign-up-success/page.tsx` | Server or client component | Static page: "Check your email for a confirmation link." |
| `app/auth/error/page.tsx` | Server or client component | Generic auth error page. Reads error info from search params if available. |
| `app/auth/callback/route.ts` | Route Handler (GET) | Reads `code` from URL search params. Calls `supabase.auth.exchangeCodeForSession(code)`. On success: redirect to `/`. On failure: redirect to `/auth/error`. |

**Login page form fields:** email (input type email), password (input type password), submit button "Sign in", link to `/auth/sign-up`.
**Sign-up page form fields:** email, password, nickname, submit button "Create account", link to `/auth/login`.

**`app/auth/callback/route.ts` implementation outline:**
```ts
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/"

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/error`)
}
```

#### Updated Existing Files (3 files)

| File | Changes |
|------|---------|
| `app/layout.tsx` | 1. Update metadata title to "L-Train Love". 2. Wrap `{children}` with `ThemeProvider` (from `components/theme-provider.tsx`). 3. Add `<Toaster />` from `components/ui/sonner.tsx` as a sibling of `{children}` inside the body. |
| `app/page.tsx` | 1. **Remove** `"use client"` directive — this becomes a **server component**. 2. Remove all swipe/match imports and logic. 3. Import server Supabase client from `lib/supabase/server.ts`. 4. Read session: `const { data: { user } } = await supabase.auth.getUser()`. 5. If `!user` → `redirect("/auth/login")`. 6. Call `getOrCreateProfile(supabase, user)`. 7. Render a new client component `<AppShell userId={user.id} />` that contains the tab navigation + lobby/waves/me views. |
| `components/subway-header.tsx` | 1. Rename app title from "SubwayMatch" to "L-Train Love". 2. Update tabs array: `lobby` (Train), `waves` (Bell), `me` (User). 3. Replace `matchCount` prop with optional `waveCount` prop. |

#### New Service / Library Files (7 files — create all)

| File | Purpose | Key exports |
|------|---------|-------------|
| `lib/stations.ts` | Hardcoded L-line stations (id + label). | `L_STATIONS: Array<{ id: string; label: string }>` |
| `lib/profile.ts` | Profile CRUD helpers. | `getOrCreateProfile(supabase, user)` — upserts a `profiles` row. `updateNickname(supabase, userId, nickname)`. |
| `lib/types.ts` | TypeScript types matching DB columns. | `Profile`, `CheckIn`, `Signal` |
| `lib/time.ts` | Time helpers for ephemeral filtering. | `twentyMinutesAgoISO()`, `isWithinMinutes(isoString, minutes)`, `formatRelativeTime(isoString)` |
| `lib/checkins.ts` | Check-in queries + realtime. | `fetchRecentCheckIns(supabase, stationId)`, `createCheckIn(supabase, { stationId, nickname, description, userId })`, `subscribeToStationCheckIns(supabase, stationId, onInsert)` |
| `lib/signals.ts` | Signal/wave queries + realtime. | `sendWave(supabase, { fromUserId, toUserId, stationId })`, `fetchRecentWaves(supabase, userId)`, `subscribeToWaves(supabase, userId, onWave)` |
| `hooks/useStationPresence.ts` | React hook for Supabase Presence. | `useStationPresence(supabase, stationId, userId, nickname)` → returns `{ presenceCount, people }` |

#### New UI Components (7 files — create all)

| File | Props | Responsibility |
|------|-------|----------------|
| `components/app-shell.tsx` | `userId: string` | Client component. Manages tab state, renders header + tab content. Fetches profile on mount. |
| `components/station-selector.tsx` | `value: string`, `onChange: (id: string) => void` | shadcn `Select` over `lib/stations.ts`. |
| `components/check-in-form.tsx` | `stationId: string`, `nickname: string`, `userId: string`, `onCheckIn: (checkIn: CheckIn) => void` | Nickname (prefilled) + description textarea + submit button. |
| `components/check-in-card.tsx` | `checkIn: CheckIn`, `isMe: boolean`, `onWave: () => void` | Single check-in card with nickname, description, "At the platform", relative time, and Wave button (hidden if `isMe`). |
| `components/station-lobby.tsx` | `userId: string`, `nickname: string` | Orchestrates station selector + check-in form + live list + presence count. Manages realtime subscriptions. |
| `components/waves-view.tsx` | `userId: string` | Lists received waves (last 20m). Each wave shows station + meetup suggestion. |
| `components/me-view.tsx` | `userId: string`, `initialNickname: string` | Edit nickname + sign out button. |

### 5.3 Mobile shell rule (390px)
Top-level container class: `max-w-[390px] w-full mx-auto min-h-screen`.
Apply this in `components/app-shell.tsx` (or in `app/page.tsx` wrapping the shell).

---

## 6) Detailed Feature Build Spec (acceptance criteria)

### 6.1 Station Lobby (manual check-in)
**Definition of done:**
- Selecting a station from the dropdown updates the lobby list.
- "Check in" creates a row in `check_ins` via Supabase.
- Lobby list updates in realtime when **other** users check in at the same station.
- Only check-ins from the **last 20 minutes** are shown (on load and after refresh).

**Edge cases:**
- Empty station → submit blocked.
- Empty nickname → submit blocked (prefill from profile).
- Station change → unsubscribe from old realtime channel, join new one, refetch.

### 6.2 Live Presence
**Definition of done:**
- Lobby shows "X people here now" using Supabase Presence.
- Count updates when users join/leave.

**Fallback:** if Presence is flaky, derive count from `check_ins` within last 20 minutes.

### 6.3 The Signal (Wave)
**Definition of done:**
- Tapping "Wave" on someone's check-in card inserts a row into `signals`.
- Recipient sees a realtime toast: "Someone waved at you!" + "Meet at the clock/turnstile."
- Wave button is hidden on your own check-in card.

**Safety:**
- Prevent waving at yourself (UI hides button; RLS blocks `from_user_id = to_user_id` optionally).
- Optional: client-side rate limit (1 wave per target per 30s).

---

## 7) Build Sequence (3-hour hackathon schedule, updated for auth)

### Phase A — Supabase + Auth (40–50 min)
1. `pnpm add @supabase/supabase-js @supabase/ssr` (see Prerequisites)
2. Create `.env.local` with Supabase URL + anon key.
3. Create `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/middleware.ts`.
4. Create `middleware.ts` at project root.
5. Create all 4 auth pages + callback route handler.
6. Update `app/layout.tsx` (ThemeProvider + Toaster).
7. Verify: sign up → check email → confirm → lands on `/` → sign out → back to `/auth/login`.

### Phase B — Profile + station list (15–20 min)
1. Run SQL: create `profiles` table + add FKs + indexes + RLS policies (see §8).
2. Create `lib/profile.ts` with `getOrCreateProfile()`.
3. Create `lib/stations.ts` with hardcoded L-line stations.
4. Create `lib/types.ts` with `Profile`, `CheckIn`, `Signal` types.
5. Delete or rename `lib/profiles.ts` (old mock data) to avoid confusion with `lib/profile.ts`.

### Phase C — Lobby (60–75 min)
1. Create `components/app-shell.tsx` (client component with tab state).
2. Update `app/page.tsx` to be a server component → auth gate → render `<AppShell />`.
3. Update `components/subway-header.tsx` (new tabs + title).
4. Create `components/station-selector.tsx`, `components/check-in-form.tsx`, `components/check-in-card.tsx`.
5. Create `components/station-lobby.tsx` (orchestrator).
6. Create `lib/checkins.ts` and `lib/time.ts`.
7. Wire up realtime subscription for check-ins.

### Phase D — Waves (30–40 min)
1. Create `lib/signals.ts`.
2. Add Wave button to `components/check-in-card.tsx`.
3. Create `components/waves-view.tsx`.
4. Wire up realtime subscription for signals.
5. Show toast on wave receipt.

### Phase E — Presence (15–20 min)
1. Create `hooks/useStationPresence.ts`.
2. Add presence count indicator to `components/station-lobby.tsx`.

### Phase F — Polish + deploy (15–20 min)
1. Empty states for lobby (no check-ins), waves (no waves), etc.
2. Enforce 390px container.
3. Tight copy ("At the platform", "Meet at the clock/turnstile").
4. `vercel deploy` + set env vars in Vercel dashboard.

---

## 8) Supabase SQL (complete, copy-ready)

Run this **once** in the Supabase SQL Editor, **after** creating the base `check_ins` and `signals` tables from the original schema.

```sql
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
-- 2. FOREIGN KEYS (add to existing tables if not already present)
-- ============================================================
-- check_ins
alter table public.check_ins
  add constraint check_ins_user_id_fkey
  foreign key (user_id) references auth.users(id)
  on delete cascade;

-- signals
alter table public.signals
  add constraint signals_from_user_id_fkey
  foreign key (from_user_id) references auth.users(id)
  on delete cascade;

alter table public.signals
  add constraint signals_to_user_id_fkey
  foreign key (to_user_id) references auth.users(id)
  on delete cascade;

-- ============================================================
-- 3. INDEXES
-- ============================================================
create index if not exists check_ins_station_created_at_idx
  on public.check_ins (station_id, created_at desc);

create index if not exists signals_to_user_created_at_idx
  on public.signals (to_user_id, created_at desc);

-- ============================================================
-- 4. ENABLE REALTIME
-- ============================================================
alter publication supabase_realtime add table check_ins;
alter publication supabase_realtime add table signals;

-- ============================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles enable row level security;
alter table public.check_ins enable row level security;
alter table public.signals enable row level security;

-- profiles: any authenticated user can read; only self can write
create policy "profiles_select_authed"
  on public.profiles for select
  to authenticated
  using (true);

create policy "profiles_insert_self"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

create policy "profiles_update_self"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- check_ins: any authenticated user can read; only self can insert
create policy "check_ins_select_authed"
  on public.check_ins for select
  to authenticated
  using (true);

create policy "check_ins_insert_self"
  on public.check_ins for insert
  to authenticated
  with check (user_id = auth.uid());

-- signals: only self can insert (as sender); only self can read (as recipient)
create policy "signals_insert_from_self"
  on public.signals for insert
  to authenticated
  with check (from_user_id = auth.uid());

create policy "signals_select_to_self"
  on public.signals for select
  to authenticated
  using (to_user_id = auth.uid());
```

---

## 9) What to Delete / Retire from the Mock

| File | Action |
|------|--------|
| `lib/profiles.ts` | **Delete** (old mock data; name collides with new `lib/profile.ts`). |
| `components/profile-card.tsx` | Stop importing. Delete later. |
| `components/swipe-buttons.tsx` | Stop importing. Delete later. |
| `components/match-overlay.tsx` | Stop importing. Delete later. |
| `components/matches-view.tsx` | Stop importing. Delete later. |
| `components/profile-view.tsx` | Stop importing. Delete later. |

All swipe/match state logic in `app/page.tsx` is replaced by the server component + `<AppShell />` pattern.

---

## 10) QA Checklist

### Auth flow
- [ ] Sign up with email + password → see "check your email" page.
- [ ] Click confirmation link → land on `/` as logged-in user.
- [ ] Sign out → redirected to `/auth/login`.
- [ ] Visit `/` while logged out → redirected to `/auth/login`.
- [ ] Visit `/auth/login` while logged in → redirected to `/`.

### Station Lobby
- [ ] Open two browser windows (incognito + normal), sign in as different users.
- [ ] Both pick the same station → check in from both → see each other appear in realtime.
- [ ] Switch stations in one window → old check-ins disappear, new station's check-ins load.

### Waves
- [ ] Wave from User A to User B → User B sees toast.
- [ ] Wave button is hidden on your own check-in card.

### Ephemeral
- [ ] Wait >20 minutes (or update `created_at` in DB) → check-in disappears from lobby.

---

## 11) Known Risks (and fastest mitigations)

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Auth + RLS misconfig** — realtime subscriptions appear "broken" | High | Start with permissive `select` for authenticated users; test with two browsers before tightening. |
| **Email confirmation delay** — users can't log in immediately after sign-up | Medium | For hackathon demo: disable email confirmation in Supabase dashboard (Auth → Settings → "Confirm email" toggle). Re-enable for production. |
| **Presence flakiness** | Medium | Ship "derived presence" from recent check-ins count as fallback. |
| **Nickname denormalization** — `check_ins.nickname` can go stale | Low | Acceptable: check-ins expire in 20 minutes. |
| **`lib/profiles.ts` vs `lib/profile.ts` naming** | Low | Delete `lib/profiles.ts` in Phase B. |
| **Timezone/timestamp parsing** | Low | Treat `created_at` as ISO strings; compare via `new Date().toISOString()`. |

---

## 12) Station Data (hardcoded, for `lib/stations.ts`)

```ts
export const L_STATIONS = [
  { id: "8-av", label: "8 Av" },
  { id: "6-av", label: "6 Av" },
  { id: "14-st-union-sq", label: "14 St–Union Sq" },
  { id: "3-av", label: "3 Av" },
  { id: "1-av", label: "1 Av" },
  { id: "bedford-av", label: "Bedford Av" },
  { id: "lorimer-st", label: "Lorimer St" },
  { id: "graham-av", label: "Graham Av" },
  { id: "grand-st", label: "Grand St" },
  { id: "montrose-av", label: "Montrose Av" },
  { id: "morgan-av", label: "Morgan Av" },
  { id: "jefferson-st", label: "Jefferson St" },
  { id: "dekalb-av", label: "DeKalb Av" },
  { id: "myrtle-wyckoff", label: "Myrtle–Wyckoff Avs" },
  { id: "halsey-st", label: "Halsey St" },
  { id: "wilson-av", label: "Wilson Av" },
  { id: "bushwick-av", label: "Bushwick Av–Aberdeen St" },
  { id: "broadway-jn", label: "Broadway Junction" },
  { id: "atlantic-av", label: "Atlantic Av" },
  { id: "sutter-av", label: "Sutter Av" },
  { id: "livonia-av", label: "Livonia Av" },
  { id: "new-lots-av", label: "New Lots Av" },
  { id: "east-105-st", label: "East 105 St" },
  { id: "canarsie", label: "Canarsie–Rockaway Pkwy" },
] as const
```
