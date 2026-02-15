import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error: sessionError } = await supabase.rpc('cleanup_stale_sessions')
  if (sessionError) {
    console.error('Cleanup stale sessions error:', sessionError)
  }

  const { error: matchError } = await supabase.rpc('cleanup_expired_matches')
  if (matchError) {
    console.error('Cleanup expired matches error:', matchError)
  }

  return NextResponse.json({ 
    success: true,
    cleaned_stale_sessions: !sessionError,
    cleaned_expired_matches: !matchError
  })
}
