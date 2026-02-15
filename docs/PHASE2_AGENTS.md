# Phase 2 — Parallel Agent Instructions

Phase 1 (foundation) is complete. Run the following SQL in your Supabase SQL Editor before agents start (see `docs/plan.md` §8). Ensure `.env.local` has `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

---

## Agent A: Station Lobby

**Prompt to use:**

> Implement the Station Lobby logic. Create `lib/checkins.ts` for fetching/subscribing to check-ins, and build the StationLobby component using StationSelector and CheckInForm. Assume userId is passed as a prop.
>
> Requirements (from docs/plan.md):
> - `lib/checkins.ts`: `fetchRecentCheckIns(supabase, stationId)`, `createCheckIn(supabase, { stationId, nickname, description, userId })`, `subscribeToStationCheckIns(supabase, stationId, onInsert)`
> - `components/station-selector.tsx`: shadcn Select over `lib/stations.ts`, props: `value`, `onChange`
> - `components/check-in-form.tsx`: nickname (prefilled), description textarea, submit "Check in (20 min)"
> - `components/check-in-card.tsx`: single check-in card (nickname, description, "At the platform", relative time). Wave button hidden for now (Agent B will add).
> - `components/station-lobby.tsx`: replace placeholder with orchestrator — station selector + check-in form + live list. Use `lib/time.ts` for 20m filtering. Wire realtime subscription.
> - Ephemeral: only show `created_at > now - 20m`. Use `twentyMinutesAgoISO()` and `isWithinMinutes()` from lib/time.ts.

**Files to create:** `lib/checkins.ts`, `components/station-selector.tsx`, `components/check-in-form.tsx`, `components/check-in-card.tsx`

**Files to replace:** `components/station-lobby.tsx` (replace placeholder)

---

## Agent B: Waves (Signals)

**Prompt to use:**

> Implement the Waves feature. Create `lib/signals.ts` for sending/receiving signals. Build the WavesView to list incoming waves. Do not implement the UI for sending waves yet, just the logic functions.
>
> Requirements (from docs/plan.md):
> - `lib/signals.ts`: `sendWave(supabase, { fromUserId, toUserId, stationId })`, `fetchRecentWaves(supabase, userId)`, `subscribeToWaves(supabase, userId, onWave)` — last 20 minutes only
> - `components/waves-view.tsx`: replace placeholder — list received waves (last 20m), each wave shows station + "Meet at the clock/turnstile". Wire realtime subscription. Show toast on new wave (use sonner).
> - Use `lib/types.ts` Signal type. Use `lib/time.ts` for 20m filtering and `formatRelativeTime()`.
> - Do NOT add Wave button to check-in-card yet (that’s integration phase).

**Files to create:** `lib/signals.ts`

**Files to replace:** `components/waves-view.tsx` (replace placeholder)

---

## Coordination Notes

- **Agent A** owns `components/check-in-card.tsx` — build it without the Wave button. Agent B does not touch it.
- **Agent B** owns `lib/signals.ts` and `components/waves-view.tsx`. Agent A does not touch these.
- Both can run in parallel. No file conflicts if they follow the above.
- After both complete: wire Wave button in `check-in-card.tsx` to `sendWave()` (integration task).
