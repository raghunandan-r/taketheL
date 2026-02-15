"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { CheckIn } from "@/lib/types"

export function CheckInForm({
  stationId,
  nickname,
  userId,
  onCheckIn,
}: {
  stationId: string
  nickname: string
  userId: string
  onCheckIn: (params: {
    stationId: string
    nickname: string
    description: string | null
    userId: string
  }) => Promise<CheckIn>
}) {
  const [description, setDescription] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = stationId && nickname.trim()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit || loading) return
    setError(null)
    setLoading(true)
    try {
      await onCheckIn({
        stationId,
        nickname: nickname.trim(),
        description: description.trim() || null,
        userId,
      })
      setDescription("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check-in failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="nickname">Nickname</Label>
        <Input
          id="nickname"
          value={nickname}
          readOnly
          className="bg-muted"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea
          id="description"
          placeholder="A few words about you..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={!canSubmit || loading} className="w-full">
        {loading ? "Checking in…" : "Check in (20 min)"}
      </Button>
    </form>
  )
}
