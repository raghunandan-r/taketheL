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

async function handleRegister(userId: string, body: { station_id: string }) {
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

async function handleDiscover(userId: string, body: { station_id: string; limit?: number }) {
  const { station_id, limit = 10 } = body

  const { data, error } = await supabase
    .from('bot_sessions')
    .select('user_id, station_id, profiles(nickname, interests)')
    .eq('station_id', station_id)
    .neq('user_id', userId)
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const bots = (data ?? []).map((b: Record<string, unknown>) => ({
    id: b.user_id,
    user_id: b.user_id,
    nickname: (b.profiles as Record<string, unknown>)?.nickname ?? 'Anonymous',
    specificity: ((b.profiles as Record<string, unknown>)?.interests as string[])?.length ?? 0,
    station_id: b.station_id
  }))

  bots.sort((a: { specificity: number }, b: { specificity: number }) => b.specificity - a.specificity)

  return NextResponse.json({ bots })
}

async function handlePropose(userId: string, body: { target_user_id: string; station_id: string; idempotency_key: string }) {
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

async function handleRespond(userId: string, body: { match_id: string; accept: boolean }) {
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

async function handleHeartbeat(userId: string, body: { station_id: string }) {
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
