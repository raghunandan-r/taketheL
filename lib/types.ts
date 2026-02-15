export interface Profile {
  id: string
  created_at: string
  nickname: string
  description: string | null
}

export interface CheckIn {
  id: string
  created_at: string
  station_id: string
  nickname: string
  description: string | null
  user_id: string
}

export interface Signal {
  id: string
  created_at: string
  from_user_id: string
  to_user_id: string
  station_id: string
  message: string
}
