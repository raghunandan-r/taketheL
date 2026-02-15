"use client"

import Image from "next/image"
import { Heart } from "lucide-react"
import { SubwayLineBadge } from "./subway-line-badge"
import type { Profile } from "@/lib/profiles"

export function MatchesView({ matches }: { matches: Profile[] }) {
  if (matches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
        <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center mb-5">
          <Heart className="w-6 h-6 text-muted-foreground" />
        </div>
        <h3 className="text-base font-semibold text-foreground mb-2">
          No matches yet
        </h3>
        <p className="text-sm text-muted-foreground max-w-[260px] leading-relaxed">
          Keep swiping to find your perfect match on the line.
        </p>
      </div>
    )
  }

  return (
    <div className="px-5 py-5">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
        Your matches ({matches.length})
      </h3>
      <div className="flex flex-col gap-2">
        {matches.map((match) => (
          <button
            key={match.id}
            className="flex items-center gap-4 p-3 rounded-2xl hover:bg-secondary transition-colors text-left"
            type="button"
          >
            <div className="relative w-14 h-14 rounded-full overflow-hidden flex-shrink-0">
              <Image
                src={match.image || "/placeholder.svg"}
                alt={match.name}
                fill
                className="object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground text-sm">
                  {match.name}, {match.age}
                </span>
                <SubwayLineBadge line={match.line} size="sm" />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {match.neighborhood} {"·"} {match.distance}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
