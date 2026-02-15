"use client"

import { useState } from "react"
import { SubwayHeader } from "@/components/subway-header"
import { StationLobby } from "@/components/station-lobby"
import { WavesView } from "@/components/waves-view"
import { MeView } from "@/components/me-view"

export function AppShell({
  userId,
  initialNickname,
}: {
  userId: string
  initialNickname: string
}) {
  const [activeTab, setActiveTab] = useState("lobby")
  const [waveCount, setWaveCount] = useState(0)

  return (
    <div className="flex flex-col min-h-screen max-w-[390px] w-full mx-auto bg-background">
      <SubwayHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        waveCount={waveCount}
      />
      <main className="flex-1 overflow-y-auto">
        {activeTab === "lobby" && (
          <StationLobby userId={userId} nickname={initialNickname} />
        )}
        {activeTab === "waves" && (
          <WavesView userId={userId} onWaveCountChange={setWaveCount} />
        )}
        {activeTab === "me" && (
          <MeView userId={userId} initialNickname={initialNickname} />
        )}
      </main>
    </div>
  )
}
