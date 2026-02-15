"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { updateNickname } from "@/lib/profile"

/**
 * Me View — minimal implementation for Phase 1.
 * Edit nickname + sign out. Agent C would enhance; for now we have basic functionality.
 */
export function MeView({
  userId,
  initialNickname,
}: {
  userId: string
  initialNickname: string
}) {
  const [nickname, setNickname] = useState(initialNickname)
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateNickname(supabase, userId, nickname)
    } finally {
      setSaving(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/auth/login")
    router.refresh()
  }

  return (
    <div className="px-4 py-6 space-y-6 max-w-[390px]">
      <div className="space-y-2">
        <Label htmlFor="nickname">Nickname</Label>
        <div className="flex gap-2">
          <Input
            id="nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="How others see you"
          />
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
      <Button variant="outline" onClick={handleSignOut} className="w-full">
        Sign out
      </Button>
    </div>
  )
}
