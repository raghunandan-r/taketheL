"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import {
  fetchRecentWaves,
  subscribeToWaves,
} from "@/lib/signals"
import { formatRelativeTime } from "@/lib/time"
import { L_STATIONS } from "@/lib/stations"
import type { Signal } from "@/lib/types"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

function getStationLabel(stationId: string): string {
  return L_STATIONS.find((s) => s.id === stationId)?.label ?? stationId
}

export function WavesView({
  userId,
  onWaveCountChange,
}: {
  userId: string
  onWaveCountChange?: (count: number) => void
}) {
  const [waves, setWaves] = useState<Signal[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const loadWaves = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await fetchRecentWaves(supabase, userId)
      setWaves(rows)
      onWaveCountChange?.(rows.length)
    } finally {
      setLoading(false)
    }
  }, [userId, supabase, onWaveCountChange])

  useEffect(() => {
    loadWaves()
  }, [loadWaves])

  useEffect(() => {
    const unsubscribe = subscribeToWaves(supabase, userId, (newWave) => {
      setWaves((prev) => {
        const exists = prev.some((w) => w.id === newWave.id)
        if (exists) return prev
        return [newWave, ...prev]
      })
      toast("Someone waved at you!", {
        description: `Meet at the clock/turnstile at ${getStationLabel(newWave.station_id)}.`,
      })
    })
    return unsubscribe
  }, [userId, supabase])

  useEffect(() => {
    onWaveCountChange?.(waves.length)
  }, [waves.length, onWaveCountChange])

  if (loading) {
    return (
      <div className="px-4 py-8 text-center text-muted-foreground">
        Loading…
      </div>
    )
  }

  if (waves.length === 0) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="text-sm text-muted-foreground">No waves yet</p>
        <p className="text-xs text-muted-foreground mt-2">
          Wave at someone in the Lobby to say hi
        </p>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 space-y-4">
      {waves.map((wave) => (
        <Card key={wave.id}>
          <CardHeader className="pb-2">
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(wave.created_at)}
            </span>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm font-medium">
              Someone waved at you at {getStationLabel(wave.station_id)}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Meet at the clock/turnstile
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
