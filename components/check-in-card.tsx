"use client"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { formatRelativeTime } from "@/lib/time"
import type { CheckIn } from "@/lib/types"

export function CheckInCard({
  checkIn,
  isMe,
  onWave,
}: {
  checkIn: CheckIn
  isMe: boolean
  onWave?: () => void
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-foreground">{checkIn.nickname}</span>
          <span className="text-xs text-muted-foreground">
            {formatRelativeTime(checkIn.created_at)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">At the platform</p>
      </CardHeader>
      <CardContent className="pt-0">
        {checkIn.description && (
          <p className="text-sm text-muted-foreground mb-3">
            {checkIn.description}
          </p>
        )}
        {!isMe && onWave && (
          <button
            type="button"
            onClick={onWave}
            className="text-sm font-medium text-primary hover:underline"
          >
            Wave
          </button>
        )}
      </CardContent>
    </Card>
  )
}
