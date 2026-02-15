import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getOrCreateProfile } from "@/lib/profile"
import { AppShell } from "@/components/app-shell"

export default async function Page() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const profile = await getOrCreateProfile(supabase, user)
  const nickname = profile?.nickname ?? user.email?.split("@")[0] ?? "user"

  return (
    <AppShell
      userId={user.id}
      initialNickname={nickname}
    />
  )
}
