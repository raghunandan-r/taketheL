"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { L_STATIONS } from "@/lib/stations"

export function StationSelector({
  value,
  onChange,
}: {
  value: string
  onChange: (id: string) => void
}) {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Select station" />
      </SelectTrigger>
      <SelectContent>
        {L_STATIONS.map((station) => (
          <SelectItem key={station.id} value={station.id}>
            {station.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
