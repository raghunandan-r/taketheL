import type { SupabaseClient } from "@supabase/supabase-js"
import type { CheckIn } from "./types"
import { twentyMinutesAgoISO, isWithinMinutes } from "./time"

export async function fetchRecentCheckIns(
  supabase: SupabaseClient,
  stationId: string
): Promise<CheckIn[]> {
  const cutoff = twentyMinutesAgoISO()
  const { data, error } = await supabase
    .from("check_ins")
    .select("*")
    .eq("station_id", stationId)
    .gt("created_at", cutoff)
    .order("created_at", { ascending: false })

  if (error) throw error
  return (data ?? []) as CheckIn[]
}

export async function createCheckIn(
  supabase: SupabaseClient,
  params: {
    stationId: string
    nickname: string
    description: string | null
    userId: string
  }
): Promise<CheckIn> {
  const { data, error } = await supabase
    .from("check_ins")
    .insert({
      station_id: params.stationId,
      nickname: params.nickname,
      description: params.description || null,
      user_id: params.userId,
    })
    .select()
    .single()

  if (error) throw error
  return data as CheckIn
}

export function subscribeToStationCheckIns(
  supabase: SupabaseClient,
  stationId: string,
  onInsert: (checkIn: CheckIn) => void
) {
  const channel = supabase
    .channel(`check_ins:${stationId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "check_ins",
      },
      (payload) => {
        const row = payload.new as CheckIn
        if (row.station_id !== stationId) return
        if (!isWithinMinutes(row.created_at, 20)) return
        onInsert(row)
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
