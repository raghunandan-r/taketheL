import { L_STATIONS } from './stations'

export const STATION_ORDER: string[] = L_STATIONS.map(s => s.id)

export const STATION_VENUES: Record<string, { name: string; category: string }[]> = {
  'bedford-av': [
    { name: 'The Levee', category: 'bar' },
    { name: 'Cafe Reggio', category: 'coffee' },
  ],
  'lorimer-st': [
    { name: 'Mochi', category: 'food' },
  ],
}

export function findMeetingStation(
  stationA: string,
  stationB: string,
  directionA: 'north' | 'south' = 'south',
  directionB: 'north' | 'south' = 'south'
): string {
  if (stationA === stationB) return stationA

  const idxA = STATION_ORDER.indexOf(stationA)
  const idxB = STATION_ORDER.indexOf(stationB)

  if (idxA === -1 || idxB === -1) return stationA

  if (directionA !== directionB) return stationA

  return idxA < idxB ? stationA : stationB
}

export function getVenueForStation(stationId: string): string | null {
  const venues = STATION_VENUES[stationId]
  if (!venues?.length) return null
  return venues[Math.floor(Math.random() * venues.length)].name
}

export function calculateSpecificity(interests: string[] | undefined): number {
  return interests?.length ?? 0
}
