"use client"

import { MapPin, Train, Settings, ChevronRight } from "lucide-react"
import { SubwayLineBadge } from "./subway-line-badge"

export function ProfileView() {
  return (
    <div className="px-5 py-6">
      {/* Avatar */}
      <div className="flex flex-col items-center text-center mb-8">
        <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mb-3">
          <span className="text-2xl font-semibold text-foreground">Y</span>
        </div>
        <h2 className="text-lg font-semibold text-foreground">You</h2>
        <div className="flex items-center gap-1.5 mt-1 text-muted-foreground">
          <MapPin className="w-3.5 h-3.5" />
          <span className="text-sm">New York City</span>
        </div>
      </div>

      {/* Your Line */}
      <div className="rounded-2xl border border-border p-4 mb-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Your line
        </h3>
        <div className="flex items-center gap-3">
          <SubwayLineBadge line="L" size="lg" />
          <div>
            <p className="font-semibold text-foreground text-sm">L Train</p>
            <p className="text-xs text-muted-foreground">1st Ave Station</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: "Matches", value: "12" },
          { label: "Likes", value: "47" },
          { label: "Stops", value: "3" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-border p-3 text-center"
          >
            <p className="text-xl font-semibold text-foreground">{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Settings */}
      <div className="rounded-2xl border border-border overflow-hidden">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 pt-4 pb-2">
          Preferences
        </h3>
        {[
          { icon: Train, label: "Preferred lines", detail: "L, G, N, Q" },
          { icon: MapPin, label: "Max distance", detail: "10 stops" },
          { icon: Settings, label: "Notifications", detail: "On" },
        ].map((item, i) => (
          <button
            key={item.label}
            className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-secondary transition-colors text-left ${
              i < 2 ? "border-b border-border" : ""
            }`}
            type="button"
          >
            <item.icon className="w-5 h-5 text-muted-foreground" />
            <span className="flex-1 text-sm text-foreground">{item.label}</span>
            <span className="text-xs text-muted-foreground mr-1">{item.detail}</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
          </button>
        ))}
      </div>
    </div>
  )
}
