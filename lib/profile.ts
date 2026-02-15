import type { SupabaseClient } from "@supabase/supabase-js"
import type { User } from "@supabase/supabase-js"
import type { Profile } from "./types"

/** Derives a default nickname from email (prefix before @). */
function emailPrefix(email: string): string {
  const idx = email.indexOf("@")
  return idx > 0 ? email.slice(0, idx) : email
}

/**
 * Ensures a profile row exists for the user. Uses upsert with ON CONFLICT DO NOTHING.
 * On first sign-up, inserts with nickname from email prefix or user_metadata.
 */
export async function getOrCreateProfile(
  supabase: SupabaseClient,
  user: User
): Promise<Profile | null> {
  const nickname =
    (user.user_metadata?.nickname as string) ??
    emailPrefix(user.email ?? "user")
  const { data } = await supabase
    .from("profiles")
    .upsert({ id: user.id, nickname }, { onConflict: "id", ignoreDuplicates: true })
    .select()
    .single()

  if (data) return data
  const { data: existing } = await supabase
    .from("profiles")
    .select()
    .eq("id", user.id)
    .single()
  return existing
}

export async function updateNickname(
  supabase: SupabaseClient,
  userId: string,
  nickname: string
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ nickname })
    .eq("id", userId)
  if (error) throw error
}
