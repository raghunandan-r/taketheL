"use client"

import Image from "next/image"
import { MapPin } from "lucide-react"
import { SubwayLineBadge } from "./subway-line-badge"
import type { Profile } from "@/lib/profiles"

export function ProfileCard({
  profile,
  swipeDirection,
}: {
  profile: Profile
  swipeDirection: "left" | "right" | null
}) {
  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl bg-card border border-border ${
        swipeDirection === "right"
          ? "animate-swipe-right"
          : swipeDirection === "left"
            ? "animate-swipe-left"
            : "animate-slide-up"
      }`}
    >
      {/* Swipe indicator overlays */}
      {swipeDirection === "right" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-primary/10 rounded-2xl">
          <span className="text-4xl font-bold text-primary rotate-[-12deg] border-[3px] border-primary px-5 py-1.5 rounded-xl tracking-wide">
            LIKE
          </span>
        </div>
      )}
      {swipeDirection === "left" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-muted">
          <span className="text-4xl font-bold text-muted-foreground rotate-[12deg] border-[3px] border-muted-foreground px-5 py-1.5 rounded-xl tracking-wide">
            PASS
          </span>
        </div>
      )}

      {/* Profile Image */}
      <div className="relative aspect-[3/4] w-full">
        <Image
          src={profile.image || "/placeholder.svg"}
          alt={`${profile.name}'s profile photo`}
          fill
          className="object-cover"
          priority
        />
        {/* Subtle bottom gradient */}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-foreground/70 to-transparent" />

        {/* Name + location overlay */}
        <div className="absolute inset-x-0 bottom-0 px-5 pb-5">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-card">
                {profile.name}, {profile.age}
              </h2>
              <div className="flex items-center gap-1.5 mt-1 text-card/80">
                <MapPin className="w-3.5 h-3.5" />
                <span className="text-sm">{profile.neighborhood}</span>
              </div>
            </div>
            <SubwayLineBadge line={profile.line} size="lg" />
          </div>
        </div>
      </div>

      {/* Details section */}
      <div className="px-5 py-4">
        {/* Station chip */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-secondary rounded-full mb-3">
          <SubwayLineBadge line={profile.line} size="sm" />
          <span className="text-xs font-medium text-secondary-foreground">
            {profile.stop}
          </span>
          <span className="text-xs text-muted-foreground">
            {"  "}{"·"}{"  "}{profile.distance}
          </span>
        </div>

        {/* Bio */}
        <p className="text-sm leading-relaxed text-muted-foreground mb-4">
          {profile.bio}
        </p>

        {/* Interests as pills */}
        <div className="flex flex-wrap gap-2">
          {profile.interests.map((interest) => (
            <span
              key={interest}
              className="px-3 py-1.5 text-xs font-medium rounded-full border border-border text-foreground"
            >
              {interest}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
