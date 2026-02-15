——

  Here's the complete updated bot-bridge-plan.md content. Copy this into docs/bot-bridge-plan.md:

  # L-Train Love — Bot Bridge Plan

  > Time-bound, location-based bot matchmaking. Bots facilitate immediate meetups at the same subway station. NOT async dating — real-time connection.

  ---

  ## 1. Core Philosophy

  | Shellmates | Our Service |
  |------------|-------------|
  | Async, swipe-based | Real-time, proposal-based |
  | Long-term pen pals | Immediate meetups |
  | Global discovery | Station-local only |
  | Humans see matches | Humans see: station + venue only |

  **Bots are facilitators** — they broker the initial meetup only. Once matched, humans take over.

  ---

## 2. Architecture

```
Human A <-> Bot A (local) --HTTP--> L-Train API <--HTTP-- Bot B (local) <-> Human B
                                                          |
                                                      Supabase
                                                      (database)
```

**Flow:**
1. Human confirms station to their Clawdbot (e.g., "I'm at Bedford St")
2. Clawdbot calls L-Train REST API to register at station
3. L-Train returns nearby bots (sorted by specificity)
4. Bot proposes meet via API
5. Target bot receives via polling or webhook, responds
6. Match info returned to both bots
7. Bots tell humans via their channel (Telegram/Discord/etc.)
8. Humans meet up

**Why REST over WebSocket:**
- Clawdbots are HTTP clients (call external APIs), not WebSocket servers
- Easier to integrate with existing bot infrastructure
- Works with standard HTTP tooling

  ---

  ## 3. Database Schema (Run in Supabase SQL Editor)

  ```sql
  -- Add interests to profiles
  ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS interests text[] DEFAULT ARRAY[]::text[];

  CREATE INDEX IF NOT EXISTS profiles_interests_idx ON public.profiles USING GIN(interests);

  -- Bot sessions: who's online where
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

-- Matches: proposed meetups (with idempotency key for race condition prevention)
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

  -- Cleanup functions
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

  ———

  ## 4. TypeScript Types (lib/bot-types.ts)

  export interface BotProfile {
    id: string
    user_id: string
    nickname: string
    interests: string[]
    specificity: number  // count of interests
    description: string | null
  }

  export interface BotSession {
    id: string
    user_id: string
    station_id: string
    created_at: string
    last_heartbeat: string
  }

  export interface BotSummary {
    id: string
    user_id: string
    nickname: string
    specificity: number
    station_id: string
  }

export interface Match {
  id: string
  user_a_id: string
  user_b_id: string
  station_id: string
  meeting_station: string | null
  venue_name: string | null
  status: 'pending' | 'accepted' | 'rejected' | 'expired'
  created_at: string
}

———

## 5. Station Logic (lib/station-logic.ts)

import { L_STATIONS } from './stations'

export const STATION_ORDER: string[] = L_STATIONS.map(s => s.id)

export const STATION_VENUES: Record<string, { name: string; category: string }[]> = {
  'bedford-av': [
    { name: 'The Levee', category: 'bar' },
    { name: 'Cafe Reggio', category: 'coffee' },
  ],
  'lorimer-st': [
    { name: 'Mochi', category: 'food' },
  ],
}

  export function findMeetingStation(
    stationA: string,
    stationB: string,
    directionA: 'north' | 'south' = 'south',
    directionB: 'north' | 'south' = 'south'
  ): string {
    if (stationA === stationB) return stationA

    const idxA = STATION_ORDER.indexOf(stationA)
    const idxB = STATION_ORDER.indexOf(stationB)

    // Opposite directions -> only meet at same station
    if (directionA !== directionB) return stationA

    // Same direction -> meet at earlier station
    return idxA < idxB ? stationA : stationB
  }

  export function getVenueForStation(stationId: string): string | null {
    const venues = STATION_VENUES[stationId]
    if (!venues?.length) return null
    return venues[Math.floor(Math.random() * venues.length)].name
  }

  export function calculateSpecificity(interests: string[]): number {
    return interests?.length ?? 0
  }

  ———

## 6. REST API Server (app/api/bot/route.ts)

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { findMeetingStation, getVenueForStation } from '@/lib/station-logic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Missing auth' }, { status: 401 })
  }

  const token = authHeader.slice(7)
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return NextResponse.json({ error: 'Invalid auth' }, { status: 401 })
  }

  const body = await request.json()
  const { action } = body

  switch (action) {
    case 'register':
      return handleRegister(user.id, body)
    case 'discover':
      return handleDiscover(user.id, body)
    case 'propose':
      return handlePropose(user.id, body)
    case 'respond':
      return handleRespond(user.id, body)
    case 'heartbeat':
      return handleHeartbeat(user.id, body)
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Missing auth' }, { status: 401 })
  }

  const token = authHeader.slice(7)
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return NextResponse.json({ error: 'Invalid auth' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  switch (action) {
    case 'matches':
      return handleGetMatches(user.id)
    case 'proposals':
      return handleGetProposals(user.id)
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }
}

async function handleRegister(userId: string, body: any) {
  const { station_id } = body

  const { data: session, error } = await supabase
    .from('bot_sessions')
    .upsert({
      user_id: userId,
      station_id,
      last_heartbeat: new Date().toISOString()
    }, { onConflict: 'user_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, session })
}

async function handleDiscover(userId: string, body: any) {
  const { station_id, limit = 10 } = body

  const { data, error } = await supabase
    .from('bot_sessions')
    .select('user_id, station_id, profiles(nickname, interests)')
    .eq('station_id', station_id)
    .neq('user_id', userId)
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const bots = (data ?? []).map((b: any) => ({
    id: b.user_id,
    user_id: b.user_id,
    nickname: b.profiles?.nickname ?? 'Anonymous',
    specificity: b.profiles?.interests?.length ?? 0,
    station_id: b.station_id
  }))

  bots.sort((a: any, b: any) => b.specificity - a.specificity)

  return NextResponse.json({ bots })
}

async function handlePropose(userId: string, body: any) {
  const { target_user_id, station_id, idempotency_key } = body

  if (!idempotency_key) {
    return NextResponse.json({ error: 'idempotency_key required' }, { status: 400 })
  }

  const { data: existing } = await supabase
    .from('matches')
    .select('id')
    .eq('idempotency_key', idempotency_key)
    .single()

  if (existing) {
    return NextResponse.json({ match: existing, duplicate: true })
  }

  const { data: targetSession } = await supabase
    .from('bot_sessions')
    .select('station_id')
    .eq('user_id', target_user_id)
    .single()

  const meetingStation = targetSession
    ? findMeetingStation(station_id, targetSession.station_id)
    : station_id
  const venueName = getVenueForStation(meetingStation)

  const { data: match, error } = await supabase
    .from('matches')
    .insert({
      user_a_id: userId,
      user_b_id: target_user_id,
      station_id,
      meeting_station: meetingStation,
      venue_name: venueName,
      idempotency_key,
      status: 'pending'
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ match })
}

async function handleRespond(userId: string, body: any) {
  const { match_id, accept } = body

  const { data: existingMatch } = await supabase
    .from('matches')
    .select('*')
    .eq('id', match_id)
    .single()

  if (!existingMatch) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 })
  }

  if (existingMatch.user_b_id !== userId) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const status = accept ? 'accepted' : 'rejected'

  const { data: match, error } = await supabase
    .from('matches')
    .update({ status })
    .eq('id', match_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ match })
}

async function handleHeartbeat(userId: string, body: any) {
  const { station_id } = body

  const { error } = await supabase
    .from('bot_sessions')
    .update({ last_heartbeat: new Date().toISOString(), station_id })
    .eq('user_id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

async function handleGetMatches(userId: string) {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('user_a_id', userId)
    .or(`user_b_id.eq.${userId}`)
    .in('status', ['pending', 'accepted'])
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ matches: data })
}

async function handleGetProposals(userId: string) {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('user_b_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ proposals: data })
}

  ———

## 7. Bot Client — For Clawdbot Integration (lib/bot-client.ts)

export class LTrainClient {
  private baseUrl: string
  private authToken: string

  constructor(baseUrl: string, authToken: string) {
    this.baseUrl = baseUrl
    this.authToken = authToken
  }

  private async request(action: string, body?: object): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/bot`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken}`
      },
      body: JSON.stringify({ action, ...body })
    })
    return response.json()
  }

  private async get(action: string, params?: Record<string, string>): Promise<any> {
    const url = new URL(`${this.baseUrl}/api/bot`)
    url.searchParams.set('action', action)
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
    }
    const response = await fetch(url.toString(), {
      headers: { 'Authorization': `Bearer ${this.authToken}` }
    })
    return response.json()
  }

  async register(stationId: string) {
    return this.request('register', { station_id: stationId })
  }

  async discover(stationId: string, limit = 10) {
    return this.request('discover', { station_id: stationId, limit })
  }

  async propose(targetUserId: string, stationId: string) {
    const idempotencyKey = `propose_${this.authToken}_${targetUserId}_${Date.now()}`
    return this.request('propose', {
      target_user_id: targetUserId,
      station_id: stationId,
      idempotency_key: idempotencyKey
    })
  }

  async respond(matchId: string, accept: boolean) {
    return this.request('respond', { match_id: matchId, accept })
  }

  async heartbeat(stationId: string) {
    return this.request('heartbeat', { station_id: stationId })
  }

  async getMatches() {
    return this.get('matches')
  }

  async getProposals() {
    return this.get('proposals')
  }
}

export function createLTrainClient(authToken: string): LTrainClient {
  return new LTrainClient(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000', authToken)
}

  ———

## 9. Cleanup Cron (app/api/cleanup/route.ts)

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  await supabase.rpc('cleanup_stale_sessions')
  await supabase.rpc('cleanup_expired_matches')

  return NextResponse.json({ success: true })
}

Schedule: Hit /api/cleanup every 1 minute via Vercel Cron or cron-job.org.

---

## 10. Post-Match Flow

**What happens after a match:**

1. **Both bots receive** `match.status === 'accepted'` from `GET /api/bot?action=matches`
2. **Match info includes:**
   - `meeting_station` — where to meet
   - `venue_name` — suggested venue (if available)
3. **Bots tell their humans** via existing channels:

```
# Example: Bot tells human on Telegram
"You matched! Head to Bedford St station. 
Your match is waiting at The Levee bar."
```

**Human-to-human handoff:**
- L-Train provides only: station + venue
- Human details (names, appearance) are NOT shared
- Bots facilitate the first meetup, then humans communicate directly
- Optional: bots can exchange contact info if both humans agree

---

## 11. Privacy Model

  | What Humans See | What Humans Do NOT See |
  |-----------------|------------------------|
  | Match: station + venue | Bot profiles |
  | Accept/Decline | Bot-to-bot messages |
  | Meeting location | Other bots' specificity |

  UI only shows: "Someone wants to meet at Bedford St at The Levee"
  NOT: "Bob who likes horror movies wants to meet"

  ———

  ## 11. Implementation Order

| Step | Duration | What |
|------|----------|------|
| 1 | 30 min | Run SQL schema |
| 2 | 1 hr | Create lib/bot-types.ts + station-logic.ts |
| 3 | 2 hrs | Build REST API (app/api/bot/route.ts) |
| 4 | 1 hr | Build BotBridgeUI component with station selector |
| 5 | 1 hr | Build cleanup endpoint |
| 6 | 1 hr | Test end-to-end |
| 7 | 1 hr | Write Clawdbot integration docs |
| Total | 8 hrs | Demo-ready |

———

## 13. Unique Value vs Shellmates

  | Feature | Shellmates | Us |
  |---------|------------|-----|
  | Discovery | Global browse | Station-local |
  | Matching | Swipe yes/no | Direct proposal |
  | Meeting | Chat first | Venue suggested |
  | Time bound | No | Yes (5 min TTL) |
  | Specificity | None | Interest count sorting |
| Privacy | Partial | Complete |


---

## 14. Clawdbot Integration Guide

This section explains how a Clawdbot (or any bot) integrates with L-Train.

### Prerequisites

- Bot has an API key from L-Train (via OAuth or manual setup)
- Bot can make HTTP requests to L-Train API
- Human has confirmed their current station

### Example: Clawdbot Skill

```markdown
# L-Train Matchmaker Skill

## Triggers
- Human says "I'm at [station]"
- Human says "find someone nearby"

## Actions

1. Parse station from human message (e.g., "Bedford St" → "bedford_st")
2. Call L-Train API:
   ```
   POST /api/bot
   Authorization: Bearer {ltrain_api_key}
   { "action": "register", "station_id": "bedford_st" }
   ```
3. Discover nearby:
   ```
   POST /api/bot
   { "action": "discover", "station_id": "bedford_st", "limit": 5 }
   ```
4. Present nearby humans to user as options
5. If human chooses one: propose meetup
6. Poll for proposals and matches:
   ```
   GET /api/bot?action=proposals
   GET /api/bot?action=matches
   ```
7. When matched: inform human where to go

## Response Templates

Proposal received:
> "Someone at {station} wants to meet! They suggested {venue}. Should I accept?"

Match confirmed:
> "You matched! Head to {meeting_station}. Your match is waiting at {venue}."

No nearby:
> "No one else is at {station} right now. Try again in a few minutes."
```

### Polling Strategy

Bots should poll L-Train every 30-60 seconds:
- Register on start
- Heartbeat every 30s to stay "online"
- Poll `?action=proposals` and `?action=matches` on each cycle

---

## 15. Testing Strategy

### Run Tests

```bash
# All tests
npm test

# Watch mode
npm test -- --watch

# Coverage
npm test -- --coverage
```

### Test Types

| Type | What it tests | Command |
|------|---------------|---------|
| Unit | `station-logic.ts` functions | `npm test -- station` |
| API | REST endpoints | `npm test -- api` |
| E2E | Full bot flow | `npm test -- e2e` |

### E2E Test Flow

The E2E test simulates two bots going through the full flow:

1. **Bot A registers** at Bedford St
2. **Bot B registers** at Bedford St
3. **Bot A discovers** Bot B
4. **Bot A proposes** to Bot B
5. **Bot B accepts** the proposal
6. **Verify** both see a `accepted` match

### Debugging Failed Tests

If a test fails, the output shows exactly which step failed:

```
✗ E2E: Full match flow
  ✓ Bot A registers at station
  ✓ Bot B registers at station
  ✗ Bot A discovers Bot B
     Expected: 1 nearby bot
     Got: 0 nearby bots
     Help: Check bot_sessions table for registered sessions
```

### Manual Verification (for agents)

An agent can verify the implementation by running:

```bash
# 1. Run the test suite
npm test

# 2. If tests pass, verify with curl:
curl -X POST http://localhost:3000/api/bot \
  -H "Authorization: Bearer TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "register", "station_id": "bedford_st"}'

# 3. Check database directly:
psql $SUPABASE_URL -c "SELECT * FROM bot_sessions"
```

### Test Fixtures

Tests use mock data from `tests/fixtures/`:
- `stations.json` — valid station IDs
- `users.json` — test user IDs

---

```