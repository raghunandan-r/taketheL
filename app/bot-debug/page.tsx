'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { STATION_ORDER, STATION_VENUES } from '@/lib/station-logic'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const STATION_LABELS: Record<string, string> = {
  '8-av': '8 Av',
  '6-av': '6 Av',
  '14-st-union-sq': '14 St–Union Sq',
  '3-av': '3 Av',
  '1-av': '1 Av',
  'bedford-av': 'Bedford Av',
  'lorimer-st': 'Lorimer St',
  'graham-av': 'Graham Av',
  'grand-st': 'Grand St',
  'canarsie': 'Canarsie–Rockaway Pkwy'
}

interface NearbyBot {
  id: string
  user_id: string
  nickname: string
  specificity: number
  station_id: string
}

interface Match {
  id: string
  user_a_id: string
  user_b_id: string
  station_id: string
  meeting_station: string | null
  venue_name: string | null
  status: 'pending' | 'accepted' | 'rejected' | 'expired'
  created_at: string
}

export default function BotDebugPage() {
  const [supabase] = useState(() => createClient())
  const [user, setUser] = useState<any>(null)
  const [stationId, setStationId] = useState<string>('bedford-av')
  const [nearbyBots, setNearbyBots] = useState<NearbyBot[]>([])
  const [proposals, setProposals] = useState<Match[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [active, setActive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [debugLog, setDebugLog] = useState<string[]>([])

  const log = (msg: string) => setDebugLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 20)])

  const refresh = useCallback(async () => {
    if (!user || !active) return
    
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      if (!token) return

      const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }

      const [botsRes, proposalsRes, matchesRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/discover_bots`, {
          method: 'POST',
          headers: { ...headers, 'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
          body: JSON.stringify({ p_station_id: stationId, p_user_id: user.id, p_limit: 10 })
        }).then(r => r.json()),
        fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/matches?user_b_id=eq.${user.id}&status=eq.pending`, {
          headers: { ...headers, 'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! }
        }).then(r => r.json()),
        fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/matches?or=(user_a_id.eq.${user.id},user_b_id.eq.${user.id})&status=in.(pending,accepted)`, {
          headers: { ...headers, 'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! }
        }).then(r => r.json()),
      ])
      
      if (botsRes) setNearbyBots(botsRes)
      setProposals(proposalsRes || [])
      setMatches(matchesRes || [])
    } catch (error: any) {
      log(`Error: ${error.message}`)
    }
  }, [user, active, stationId, supabase])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [supabase])

  useEffect(() => {
    if (active && user) {
      refresh()
      const interval = setInterval(refresh, 5000)
      return () => clearInterval(interval)
    }
  }, [active, user, refresh])

  async function handleRegister() {
    if (!user) return
    setLoading(true)
    log(`Registering at ${stationId}...`)
    
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/bot_sessions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          user_id: user.id,
          station_id: stationId,
          last_heartbeat: new Date().toISOString()
        })
      })
      
      if (res.ok) {
        setActive(true)
        log(`Registered successfully at ${STATION_LABELS[stationId] || stationId}`)
      } else {
        const err = await res.text()
        log(`Register failed: ${err}`)
      }
    } catch (error: any) {
      log(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  async function handlePropose(targetUserId: string) {
    log(`Proposing to ${targetUserId}...`)
    const idempotencyKey = `debug_${user.id}_${targetUserId}_${Date.now()}`
    
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/matches`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          user_a_id: user.id,
          user_b_id: targetUserId,
          station_id: stationId,
          meeting_station: stationId,
          venue_name: STATION_VENUES[stationId]?.[0]?.name || 'The Levee',
          idempotency_key: idempotencyKey,
          status: 'pending'
        })
      })
      
      if (res.ok) {
        log('Proposal sent!')
        refresh()
      } else {
        const err = await res.text()
        log(`Propose failed: ${err}`)
      }
    } catch (error: any) {
      log(`Error: ${error.message}`)
    }
  }

  async function handleRespond(matchId: string, accept: boolean) {
    log(`${accept ? 'Accepting' : 'Declining'} proposal ${matchId}...`)
    
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/matches?id=eq.${matchId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({ status: accept ? 'accepted' : 'rejected' })
      })
      
      if (res.ok) {
        log(accept ? 'Proposal accepted!' : 'Proposal declined')
        refresh()
      } else {
        const err = await res.text()
        log(`Respond failed: ${err}`)
      }
    } catch (error: any) {
      log(`Error: ${error.message}`)
    }
  }

  if (!user) {
    return (
      <div className="p-4">
        <p>Please sign in to test the bot bridge.</p>
        <Button onClick={() => window.location.href = '/auth/login'} className="mt-4">
          Go to Login
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold">Bot Bridge Debug</h1>
      <p className="text-muted-foreground">Test the bot matchmaking flow manually</p>

      <Card className="p-4 space-y-4">
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Label>Your Station</Label>
            <select
              value={stationId}
              onChange={(e) => setStationId(e.target.value)}
              className="w-full border rounded px-2 py-1"
              disabled={active}
            >
              {STATION_ORDER.map(s => (
                <option key={s} value={s}>{STATION_LABELS[s] || s}</option>
              ))}
            </select>
          </div>
          {!active ? (
            <Button onClick={handleRegister} disabled={loading}>
              {loading ? 'Registering...' : 'Register Bot'}
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-sm">Active</span>
            </div>
          )}
        </div>
      </Card>

      {active && (
        <>
          <Card className="p-4">
            <h2 className="font-semibold mb-2">Debug Log</h2>
            <div className="bg-muted p-2 rounded text-xs font-mono h-48 overflow-y-auto">
              {debugLog.length === 0 ? (
                <p className="text-muted-foreground">No activity yet...</p>
              ) : (
                debugLog.map((log, i) => (
                  <p key={i} className="mb-1">{log}</p>
                ))
              )}
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="font-semibold mb-2">Incoming Proposals ({proposals.length})</h2>
            {proposals.length === 0 ? (
              <p className="text-muted-foreground text-sm">No pending proposals</p>
            ) : (
              proposals.map(p => (
                <div key={p.id} className="border-b py-2 last:border-0">
                  <p className="text-sm">From: {p.user_a_id.slice(0, 8)}...</p>
                  <p className="text-sm">Meet at: {p.meeting_station} {p.venue_name && `@ ${p.venue_name}`}</p>
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" onClick={() => handleRespond(p.id, true)}>Accept</Button>
                    <Button size="sm" variant="outline" onClick={() => handleRespond(p.id, false)}>Decline</Button>
                  </div>
                </div>
              ))
            )}
          </Card>

          <Card className="p-4">
            <h2 className="font-semibold mb-2">Matches ({matches.filter(m => m.status === 'accepted').length})</h2>
            {matches.filter(m => m.status === 'accepted').length === 0 ? (
              <p className="text-muted-foreground text-sm">No matches yet</p>
            ) : (
              matches.filter(m => m.status === 'accepted').map(m => (
                <div key={m.id} className="border-b py-2 last:border-0">
                  <p className="text-sm font-medium">MATCH! 🎉</p>
                  <p className="text-sm">Meet at: {m.meeting_station}</p>
                  {m.venue_name && <p className="text-sm">Venue: {m.venue_name}</p>}
                </div>
              ))
            )}
          </Card>

          <Card className="p-4">
            <h2 className="font-semibold mb-2">Nearby Bots ({nearbyBots.length})</h2>
            {nearbyBots.length === 0 ? (
              <p className="text-muted-foreground text-sm">No one else at this station</p>
            ) : (
              nearbyBots.map(bot => (
                <div key={bot.id} className="flex justify-between items-center border-b py-2 last:border-0">
                  <div>
                    <p className="font-medium">{bot.nickname || 'Anonymous'}</p>
                    <p className="text-xs text-muted-foreground">Specificity: {bot.specificity}</p>
                  </div>
                  <Button size="sm" onClick={() => handlePropose(bot.user_id)}>Wave</Button>
                </div>
              ))
            )}
          </Card>
        </>
      )}
    </div>
  )
}
