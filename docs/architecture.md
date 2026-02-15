# L-Train Love — Product Architecture Diagrams

This document contains **copy-pasteable Mermaid diagrams** for the MVP architecture described in `docs/plan.md`.

> Tip: GitHub and many Markdown renderers support Mermaid natively. If yours doesn't, paste these into [mermaid.live](https://mermaid.live).

---

## 1) System Architecture (high level)

```mermaid
flowchart TB
  subgraph Client["Mobile Web Client (Next.js App Router)"]
    MW["middleware.ts\n(refreshes auth cookies,\nredirects unauthed users)"]
    AuthPages["Auth Pages\n/auth/login\n/auth/sign-up\n/auth/sign-up-success\n/auth/error"]
    Callback["Route Handler\n/auth/callback/route.ts\n(exchanges code for session)"]
    ServerPage["app/page.tsx\n(server component,\nreads session, renders AppShell)"]
    AppShell["AppShell\n(client component,\ntabs + realtime)"]
    Toaster["Toasts (sonner)"]
  end

  subgraph SupabaseClients["Supabase Client Layer"]
    SC["lib/supabase/client.ts\n(createBrowserClient)"]
    SS["lib/supabase/server.ts\n(createServerClient + cookies)"]
    SM["lib/supabase/middleware.ts\n(updateSession helper)"]
  end

  subgraph Supabase["Supabase Backend"]
    AU["Auth\n(auth.users)"]
    PG["Postgres\n(profiles, check_ins, signals)"]
    RT["Realtime\n(postgres_changes + Presence)"]
  end

  MW --> SM
  AuthPages --> SC
  Callback --> SS
  ServerPage --> SS
  AppShell --> SC

  SC <-- "Auth API + DB queries" --> AU
  SC <-- "DB queries" --> PG
  SC <-- "WS realtime" --> RT
  SS <-- "Auth API + DB queries" --> AU
  SS <-- "DB queries" --> PG
  RT <-- "CDC\n(publication supabase_realtime)" --> PG
```

---

## 2) Data Model (tables + relationships)

```mermaid
erDiagram
  AUTH_USERS {
    uuid id PK
    text email
    timestamptz created_at
  }

  PROFILES {
    uuid id PK "references auth.users(id)"
    timestamptz created_at
    text nickname
    text description
  }

  CHECK_INS {
    uuid id PK
    timestamptz created_at
    text station_id
    text nickname "denormalized from profiles"
    text description
    uuid user_id "references auth.users(id)"
  }

  SIGNALS {
    uuid id PK
    timestamptz created_at
    uuid from_user_id "references auth.users(id)"
    uuid to_user_id "references auth.users(id)"
    text station_id
    text message "default wave emoji"
  }

  AUTH_USERS ||--|| PROFILES : "1:1 (id)"
  AUTH_USERS ||--o{ CHECK_INS : "user_id"
  AUTH_USERS ||--o{ SIGNALS : "from_user_id (sender)"
  AUTH_USERS ||--o{ SIGNALS : "to_user_id (recipient)"
```

Notes:
- `profiles.id` references `auth.users(id)` with `on delete cascade`.
- `check_ins.nickname` is intentionally denormalized (check-ins expire in 20 minutes, so stale nicknames are not a concern).
- Ephemeral behavior: filter `created_at > now() - 20m` in queries, never delete rows.

---

## 3) Auth Flow (sequence)

```mermaid
sequenceDiagram
  autonumber
  participant U as User (browser)
  participant MW as middleware.ts
  participant Login as /auth/login
  participant SignUp as /auth/sign-up
  participant Success as /auth/sign-up-success
  participant CB as /auth/callback (route handler)
  participant SB as Supabase Auth
  participant Page as app/page.tsx (server)

  Note over U,Page: SIGN UP FLOW
  U->>MW: GET /
  MW->>MW: no session in cookies
  MW-->>U: redirect /auth/login
  U->>Login: view login page
  U->>SignUp: click "Create account" link
  U->>SignUp: submit email + password + nickname
  SignUp->>SB: signUp({ email, password, emailRedirectTo: /auth/callback })
  SB-->>SignUp: success (confirmation email sent)
  SignUp-->>U: redirect /auth/sign-up-success
  Success-->>U: "Check your email"

  Note over U,Page: EMAIL CONFIRMATION
  U->>U: click link in email
  U->>CB: GET /auth/callback?code=xxx
  CB->>SB: exchangeCodeForSession(code)
  SB-->>CB: session established (cookies set)
  CB-->>U: redirect /

  Note over U,Page: AUTHENTICATED APP LOAD
  U->>MW: GET /
  MW->>MW: valid session in cookies (refreshed)
  MW-->>U: pass through
  U->>Page: server component renders
  Page->>SB: getUser() from cookies
  SB-->>Page: user object
  Page->>Page: getOrCreateProfile(user)
  Page-->>U: render AppShell(userId)

  Note over U,Page: SIGN IN FLOW (returning user)
  U->>Login: submit email + password
  Login->>SB: signInWithPassword({ email, password })
  SB-->>Login: session established (cookies set)
  Login-->>U: router.push("/")

  Note over U,Page: SIGN OUT
  U->>U: click "Sign out" in Me tab
  U->>SB: signOut()
  SB-->>U: session cleared
  U-->>Login: router.push("/auth/login")
```

---

## 4) Realtime Channel Map

```mermaid
flowchart LR
  subgraph Tabs["App Tabs (inside AppShell)"]
    Lobby["Lobby Tab\n(station-lobby.tsx)"]
    Waves["Waves Tab\n(waves-view.tsx)"]
    Me["Me Tab\n(me-view.tsx)"]
  end

  subgraph RT["Supabase Realtime Subscriptions"]
    CI["postgres_changes:\npublic.check_ins INSERT\nRLS: open to all authed\n(client filters by station_id)"]
    SG["postgres_changes:\npublic.signals INSERT\nRLS: only to_user_id = auth.uid()\n(no client filter needed)"]
    PR["presence channel:\nstation:{station_id}\n(track user_id + nickname)"]
  end

  Lobby --> CI
  Lobby --> PR
  Waves --> SG
```

Key RLS implications:
- **check_ins**: RLS allows all authenticated users to `select`, so the client receives ALL new check-ins via realtime. Client must filter by `station_id === currentStation` and `created_at > now - 20m`.
- **signals**: RLS restricts `select` to `to_user_id = auth.uid()`, so the client ONLY receives waves addressed to the current user. No client-side filtering needed.

---

## 5) Sequence — App Boot (authenticated user)

```mermaid
sequenceDiagram
  autonumber
  participant U as User
  participant MW as middleware.ts
  participant Page as app/page.tsx (server)
  participant SS as lib/supabase/server.ts
  participant DB as Postgres
  participant Shell as AppShell (client)
  participant RT as Realtime

  U->>MW: GET /
  MW->>MW: call updateSession(req) — refresh cookies
  MW-->>U: pass through (session valid)
  U->>Page: server render
  Page->>SS: createClient()
  SS-->>Page: supabase (server)
  Page->>SS: supabase.auth.getUser()
  SS-->>Page: user { id, email }
  Page->>DB: upsert profiles (id=user.id) if missing
  DB-->>Page: profile { nickname }
  Page-->>Shell: render AppShell(userId=user.id)
  Shell->>Shell: default to Lobby tab
  Shell->>DB: select check_ins where station_id and created_at > now-20m
  DB-->>Shell: rows
  Shell->>RT: subscribe postgres_changes(check_ins INSERT)
  Shell->>RT: subscribe postgres_changes(signals INSERT)
  Shell->>RT: join presence channel for station
  RT-->>Shell: initial presence state
```

---

## 6) Sequence — Create Check-in

```mermaid
sequenceDiagram
  autonumber
  participant U as User
  participant Form as CheckInForm
  participant SB as Supabase Client (browser)
  participant DB as Postgres
  participant RT as Realtime
  participant Others as Other clients at same station

  U->>Form: fill nickname + description
  U->>Form: tap "Check in"
  Form->>SB: insert check_ins { station_id, nickname, description, user_id: auth.uid() }
  SB->>DB: INSERT (RLS: user_id must = auth.uid())
  DB-->>SB: inserted row
  SB-->>Form: optimistic update (prepend to list)

  DB-->>RT: CDC event (INSERT check_ins)
  RT-->>Others: subscription payload
  Others->>Others: if station matches and within 20m, add to list
```

---

## 7) Sequence — Presence

```mermaid
sequenceDiagram
  autonumber
  participant A as Client A (at Bedford Av)
  participant B as Client B (at Bedford Av)
  participant RT as Presence Channel (station:bedford-av)

  A->>RT: join + track({ user_id: A, nickname: "Alex" })
  RT-->>A: presence_state (empty or existing)

  B->>RT: join + track({ user_id: B, nickname: "Blake" })
  RT-->>B: presence_state (A is here)
  RT-->>A: presence_diff (B joined)

  Note over A,B: Both see "2 people here now"

  B->>B: close tab / switch station
  RT-->>A: presence_diff (B left)
  Note over A: Now shows "1 person here now"
```

---

## 8) Sequence — Send Wave + Receive Wave

```mermaid
sequenceDiagram
  autonumber
  participant A as Sender (CheckInCard)
  participant SB as Supabase Client (browser)
  participant DB as Postgres
  participant RT as Realtime
  participant B as Recipient (waves listener)

  A->>SB: insert signals { from_user_id: A, to_user_id: B, station_id, message: "wave" }
  SB->>DB: INSERT (RLS: from_user_id must = auth.uid())
  DB-->>SB: inserted row
  SB-->>A: optional "Wave sent!" toast

  DB-->>RT: CDC event (INSERT signals)
  Note over RT: RLS filter: only deliver to client where auth.uid() = to_user_id
  RT-->>B: subscription payload (signal row)
  B->>B: toast "Someone waved at you!"
  B->>B: show "Meet at the clock/turnstile"
  B->>B: append to Waves tab list
```

---

## 9) File / Component Dependency Graph

```mermaid
flowchart TD
  subgraph Auth["Auth Layer"]
    MW["middleware.ts"] --> SMW["lib/supabase/middleware.ts"]
    LoginPage["app/auth/login/page.tsx"] --> SC["lib/supabase/client.ts"]
    SignUpPage["app/auth/sign-up/page.tsx"] --> SC
    CallbackRoute["app/auth/callback/route.ts"] --> SS["lib/supabase/server.ts"]
    SuccessPage["app/auth/sign-up-success/page.tsx"]
    ErrorPage["app/auth/error/page.tsx"]
  end

  subgraph App["App Layer"]
    Page["app/page.tsx\n(server component)"] --> SS
    Page --> Profile["lib/profile.ts"]
    Page --> Shell["components/app-shell.tsx"]
  end

  subgraph Shell_["AppShell (client)"]
    Shell --> Header["components/subway-header.tsx"]
    Shell --> Lobby["components/station-lobby.tsx"]
    Shell --> WavesView["components/waves-view.tsx"]
    Shell --> MeView["components/me-view.tsx"]
  end

  subgraph Lobby_["Station Lobby"]
    Lobby --> Selector["components/station-selector.tsx"]
    Lobby --> Form["components/check-in-form.tsx"]
    Lobby --> Card["components/check-in-card.tsx"]
    Lobby --> CheckinsLib["lib/checkins.ts"]
    Lobby --> PresenceHook["hooks/useStationPresence.ts"]
    Lobby --> Stations["lib/stations.ts"]
  end

  subgraph Services["Service Layer"]
    CheckinsLib --> SC
    WavesView --> SignalsLib["lib/signals.ts"]
    SignalsLib --> SC
    PresenceHook --> SC
    Profile --> SS
    CheckinsLib --> Time["lib/time.ts"]
    WavesView --> Time
  end

  subgraph Types["Shared"]
    TypesFile["lib/types.ts"]
  end

  CheckinsLib --> TypesFile
  SignalsLib --> TypesFile
  Profile --> TypesFile
```

---

## 10) Deployment Architecture

```mermaid
flowchart LR
  Dev["Local dev\n(next dev)"] -->|git push| GH["Git Repo"]
  GH -->|auto-deploy| Vercel["Vercel\n(Next.js)"]

  subgraph Vercel_Env["Vercel Environment Variables"]
    URL["NEXT_PUBLIC_SUPABASE_URL"]
    Key["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
  end

  Vercel --> Vercel_Env
  Vercel <-->|"API + Realtime WS"| Supabase["Supabase Project\n(Auth + Postgres + Realtime)"]
```

---

## 11) Security Posture (MVP)

With **Supabase Auth + RLS**, the security model is:

| Table | select | insert | update | delete |
|-------|--------|--------|--------|--------|
| `profiles` | All authed users | Self only (`id = auth.uid()`) | Self only | Not allowed |
| `check_ins` | All authed users | Self only (`user_id = auth.uid()`) | Not allowed | Not allowed |
| `signals` | Self only (`to_user_id = auth.uid()`) | Self only (`from_user_id = auth.uid()`) | Not allowed | Not allowed |

**Practical MVP advice:**
- Start with these permissive-for-read policies. Test realtime with two browser windows before tightening.
- Keep `update`/`delete` disabled until after core flows work.
- For hackathon demo: consider disabling email confirmation in Supabase dashboard (Auth → Settings) to speed up the sign-up flow. Re-enable for production.
