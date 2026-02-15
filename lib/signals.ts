import type { SupabaseClient } from "@supabase/supabase-js"
import type { Signal } from "./types"
import { twentyMinutesAgoISO, isWithinMinutes } from "./time"

export async function sendWave(
  supabase: SupabaseClient,
  params: {
    fromUserId: string
    toUserId: string
    stationId: string
    message?: string
  }
): Promise<Signal> {
  const { data, error } = await supabase
    .from("signals")
    .insert({
      from_user_id: params.fromUserId,
      to_user_id: params.toUserId,
      station_id: params.stationId,
      message: params.message ?? "👋",
    })
    .select()
    .single()

  if (error) throw error
  return data as Signal
}

export async function fetchRecentWaves(
  supabase: SupabaseClient,
  userId: string
): Promise<Signal[]> {
  const cutoff = twentyMinutesAgoISO()
  const { data, error } = await supabase
    .from("signals")
    .select("*")
    .eq("to_user_id", userId)
    .gt("created_at", cutoff)
    .order("created_at", { ascending: false })

  if (error) throw error
  return (data ?? []) as Signal[]
}

export function subscribeToWaves(
  supabase: SupabaseClient,
  userId: string,
  onWave: (signal: Signal) => void
) {
  const channel = supabase
    .channel(`waves:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "signals",
      },
      (payload) => {
        const row = payload.new as Signal
        if (row.to_user_id !== userId) return
        if (!isWithinMinutes(row.created_at, 20)) return
        onWave(row)
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
