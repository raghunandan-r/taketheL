"use client"

import Image from "next/image"
import { Heart, MessageCircle } from "lucide-react"
import { SubwayLineBadge } from "./subway-line-badge"
import type { Profile } from "@/lib/profiles"

export function MatchOverlay({
  profile,
  onClose,
  onMessage,
}: {
  profile: Profile
  onClose: () => void
  onMessage: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/40 backdrop-blur-sm">
      <div className="animate-match-pop w-full max-w-sm bg-card rounded-t-3xl sm:rounded-3xl overflow-hidden text-center">
        <div className="px-6 pt-10 pb-8">
          {/* Heart icon */}
          <div className="relative mx-auto w-14 h-14 mb-5">
            <div className="absolute inset-0 rounded-full bg-primary/20 animate-pulse-ring" />
            <div className="relative flex items-center justify-center w-14 h-14 rounded-full bg-primary">
              <Heart className="w-7 h-7 text-primary-foreground fill-primary-foreground" />
            </div>
          </div>

          <h2 className="text-xl font-semibold text-foreground mb-1">
            {"It's a match!"}
          </h2>
          <p className="text-sm text-muted-foreground mb-8">
            You and {profile.name} are on the same line
          </p>

          {/* Profile avatar */}
          <div className="relative w-20 h-20 mx-auto mb-3 rounded-full overflow-hidden ring-2 ring-primary/20">
            <Image
              src={profile.image || "/placeholder.svg"}
              alt={profile.name}
              fill
              className="object-cover"
            />
          </div>
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="font-semibold text-foreground">
              {profile.name}, {profile.age}
            </span>
            <SubwayLineBadge line={profile.line} size="sm" />
          </div>
          <p className="text-xs text-muted-foreground mb-8">
            {profile.neighborhood}
          </p>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <button
              onClick={onMessage}
              className="flex items-center justify-center gap-2 w-full py-3.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm transition-all hover:opacity-90 active:scale-[0.98]"
              type="button"
            >
              <MessageCircle className="w-4 h-4" />
              Send a message
            </button>
            <button
              onClick={onClose}
              className="w-full py-3.5 text-muted-foreground font-medium text-sm transition-colors hover:text-foreground"
              type="button"
            >
              Keep swiping
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
