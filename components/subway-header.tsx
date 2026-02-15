"use client"

import { Train, Bell, User } from "lucide-react"

export function SubwayHeader({
  activeTab,
  onTabChange,
  waveCount,
}: {
  activeTab: string
  onTabChange: (tab: string) => void
  waveCount?: number
}) {
  const tabs = [
    { id: "lobby", label: "Lobby", icon: Train },
    { id: "waves", label: "Waves", icon: Bell },
    { id: "me", label: "Me", icon: User },
  ]

  return (
    <header className="sticky top-0 z-50 bg-background border-b border-border">
      {/* Logo bar */}
      <div className="flex items-center justify-between px-5 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary">
            <Train className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="text-base font-semibold text-foreground tracking-tight">
            L-Train Love
          </span>
        </div>
        {waveCount !== undefined && waveCount > 0 && (
          <button
            onClick={() => onTabChange("waves")}
            className="text-xs font-medium text-primary"
            type="button"
          >
            {waveCount} {waveCount === 1 ? "wave" : "waves"}
          </button>
        )}
      </div>

      {/* Tab bar */}
      <nav className="flex px-2" role="tablist" aria-label="App navigation">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => onTabChange(tab.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors relative ${
                isActive ? "text-foreground" : "text-muted-foreground"
              }`}
              type="button"
            >
              <tab.icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 1.5} />
              <span>{tab.label}</span>
              {isActive && (
                <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 rounded-full bg-foreground" />
              )}
            </button>
          )
        })}
      </nav>
    </header>
  )
}
