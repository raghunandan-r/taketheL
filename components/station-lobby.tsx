"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import {
  fetchRecentCheckIns,
  createCheckIn,
  subscribeToStationCheckIns,
} from "@/lib/checkins"
import { sendWave } from "@/lib/signals"
import { StationSelector } from "@/components/station-selector"
import { CheckInForm } from "@/components/check-in-form"
import { CheckInCard } from "@/components/check-in-card"
import type { CheckIn } from "@/lib/types"
import { L_STATIONS } from "@/lib/stations"

export function StationLobby({
  userId,
  nickname,
}: {
  userId: string
  nickname: string
}) {
  const [stationId, setStationId] = useState("")
  const [checkIns, setCheckIns] = useState<CheckIn[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const loadCheckIns = useCallback(async () => {
    if (!stationId) {
      setCheckIns([])
      return
    }
    setLoading(true)
    try {
      const rows = await fetchRecentCheckIns(supabase, stationId)
      setCheckIns(rows)
    } finally {
      setLoading(false)
    }
  }, [stationId, supabase])

  useEffect(() => {
    loadCheckIns()
  }, [loadCheckIns])

  useEffect(() => {
    if (!stationId) return
    const unsubscribe = subscribeToStationCheckIns(
      supabase,
      stationId,
      (newCheckIn) => {
        setCheckIns((prev) => {
          const exists = prev.some((c) => c.id === newCheckIn.id)
          if (exists) return prev
          return [newCheckIn, ...prev]
        })
      }
    )
    return unsubscribe
  }, [stationId, supabase])

  const handleCheckIn = useCallback(
    async (params: {
      stationId: string
      nickname: string
      description: string | null
      userId: string
    }) => {
      const created = await createCheckIn(supabase, params)
      setCheckIns((prev) => [created, ...prev])
      return created
    },
    [supabase]
  )

  const stationLabel = L_STATIONS.find((s) => s.id === stationId)?.label ?? ""

  return (
    <div className="px-4 py-6 space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-medium">Station</label>
        <StationSelector value={stationId} onChange={setStationId} />
      </div>

      {stationId && (
        <>
          <CheckInForm
            stationId={stationId}
            nickname={nickname}
            userId={userId}
            onCheckIn={handleCheckIn}
          />

          <div className="space-y-2">
            <h3 className="text-sm font-medium">Live check-ins</h3>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : checkIns.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No recent check-ins at {stationLabel}.
              </p>
            ) : (
              <div className="space-y-3">
                {checkIns.map((checkIn) => (
                  <CheckInCard
                    key={checkIn.id}
                    checkIn={checkIn}
                    isMe={checkIn.user_id === userId}
                    onWave={
                      checkIn.user_id !== userId
                        ? async () => {
                            await sendWave(supabase, {
                              fromUserId: userId,
                              toUserId: checkIn.user_id,
                              stationId,
                            })
                            toast.success("Wave sent!")
                          }
                        : undefined
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
