export interface BotProfile {
  id: string
  user_id: string
  nickname: string
  interests: string[]
  specificity: number
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
