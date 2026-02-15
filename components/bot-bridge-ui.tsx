'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { LTrainClient } from '@/lib/bot-client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { STATION_ORDER } from '@/lib/station-logic'

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
  'montrose-av': 'Montrose Av',
  'morgan-av': 'Morgan Av',
  'jefferson-st': 'Jefferson St',
  'dekalb-av': 'DeKalb Av',
  'myrtle-wyckoff': 'Myrtle–Wyckoff Avs',
  'halsey-st': 'Halsey St',
  'wilson-av': 'Wilson Av',
  'bushwick-av': 'Bushwick Av',
  'broadway-jn': 'Broadway Junction',
  'atlantic-av': 'Atlantic Av',
  'sutter-av': 'Sutter Av',
  'livonia-av': 'Livonia Av',
  'new-lots-av': 'New Lots Av',
  'east-105-st': 'East 105 St',
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

export function BotBridgeUI({ userId }: { userId: string }) {
  const [ltrain, setLtrain] = useState<LTrainClient | null>(null)
  const [stationId, setStationId] = useState<string>('')
  const [nearbyBots, setNearbyBots] = useState<NearbyBot[]>([])
  const [proposals, setProposals] = useState<Match[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [active, setActive] = useState(false)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const refresh = useCallback(async () => {
    if (!ltrain || !stationId) return
    
    try {
      const [botsRes, proposalsRes, matchesRes] = await Promise.all([
        ltrain.discover(stationId),
        ltrain.getProposals(),
        ltrain.getMatches()
      ]) as [{ bots?: NearbyBot[] }, { proposals?: Match[] }, { matches?: Match[] }]
      
      if (botsRes.bots) setNearbyBots(botsRes.bots)
      if (proposalsRes.proposals) setProposals(proposalsRes.proposals)
      if (matchesRes.matches) setMatches(matchesRes.matches)
    } catch (error) {
      console.error('Refresh error:', error)
    }
  }, [ltrain, stationId])

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      setLtrain(new LTrainClient(
        process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        session.access_token
      ))
    }
    init()
  }, [])

  useEffect(() => {
    if (active && stationId && ltrain) {
      refresh()
      const interval = setInterval(refresh, 30000)
      return () => clearInterval(interval)
    }
  }, [active, stationId, ltrain, refresh])

  async function handleActivate() {
    if (!stationId || !ltrain) return
    setLoading(true)
    try {
      await ltrain.register(stationId)
      setActive(true)
    } catch (error) {
      console.error('Activation error:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handlePropose(targetUserId: string) {
    if (!ltrain) return
    try {
      await ltrain.propose(targetUserId, stationId)
      refresh()
    } catch (error) {
      console.error('Propose error:', error)
    }
  }

  async function handleRespond(matchId: string, accept: boolean) {
    if (!ltrain) return
    try {
      await ltrain.respond(matchId, accept)
      refresh()
    } catch (error) {
      console.error('Respond error:', error)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <select
          value={stationId}
          onChange={(e) => setStationId(e.target.value)}
          className="border rounded px-2 py-1"
          disabled={active}
        >
          <option value="">Select your station</option>
          {STATION_ORDER.map(s => (
            <option key={s} value={s}>{STATION_LABELS[s] || s}</option>
          ))}
        </select>
        {!active ? (
          <Button onClick={handleActivate} disabled={!stationId || loading}>
            {loading ? 'Activating...' : 'Activate Bot'}
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-sm">Active at {STATION_LABELS[stationId] || stationId}</span>
          </div>
        )}
      </div>

      {active && (
        <>
          {proposals.length > 0 && (
            <Card className="p-4 border-green-500">
              <p className="font-medium">Incoming Proposals ({proposals.length})</p>
              {proposals.map(p => (
                <div key={p.id} className="mt-2 p-2 bg-muted rounded">
                  <p>Meet at {p.meeting_station} {p.venue_name && `at ${p.venue_name}`}</p>
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" onClick={() => handleRespond(p.id, true)}>Accept</Button>
                    <Button size="sm" variant="outline" onClick={() => handleRespond(p.id, false)}>Decline</Button>
                  </div>
                </div>
              ))}
            </Card>
          )}

          {matches.filter(m => m.status === 'accepted').length > 0 && (
            <Card className="p-4 border-blue-500">
              <p className="font-medium">Matches!</p>
              {matches.filter(m => m.status === 'accepted').map(m => (
                <div key={m.id} className="mt-2 p-2 bg-blue-50 dark:bg-blue-900 rounded">
                  <p>Meet at {m.meeting_station}</p>
                  {m.venue_name && <p className="text-sm">Venue: {m.venue_name}</p>}
                </div>
              ))}
            </Card>
          )}

          <div className="space-y-2">
            <h3 className="font-medium">Nearby ({nearbyBots.length})</h3>
            {nearbyBots.length === 0 ? (
              <p className="text-sm text-muted-foreground">No one else nearby</p>
            ) : (
              nearbyBots.map((bot) => (
                <Card key={bot.id} className="p-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{bot.nickname}</p>
                      <p className="text-xs text-muted-foreground">Specificity: {bot.specificity}</p>
                    </div>
                    <Button size="sm" onClick={() => handlePropose(bot.id)}>Wave</Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
