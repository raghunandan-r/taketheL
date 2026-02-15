import { describe, it, expect } from 'vitest'
import { 
  STATION_ORDER, 
  findMeetingStation, 
  getVenueForStation, 
  calculateSpecificity 
} from '@/lib/station-logic'

describe('station-logic', () => {
  describe('STATION_ORDER', () => {
    it('should have valid stations', () => {
      expect(STATION_ORDER).toBeDefined()
      expect(STATION_ORDER.length).toBeGreaterThan(0)
      expect(STATION_ORDER).toContain('bedford-av')
      expect(STATION_ORDER).toContain('lorimer-st')
    })
  })

  describe('findMeetingStation', () => {
    it('should return same station when both at same station', () => {
      const result = findMeetingStation('bedford-av', 'bedford-av')
      expect(result).toBe('bedford-av')
    })

    it('should return earlier station when traveling same direction south', () => {
      const result = findMeetingStation('8-av', 'bedford-av', 'south', 'south')
      expect(result).toBe('8-av')
    })

    it('should return earlier station when traveling same direction north', () => {
      const result = findMeetingStation('lorimer-st', 'canarsie', 'north', 'north')
      expect(result).toBe('lorimer-st')
    })

    it('should return first station when traveling opposite directions', () => {
      const result = findMeetingStation('8-av', 'bedford-av', 'south', 'north')
      expect(result).toBe('8-av')
    })

    it('should return second station when traveling opposite directions', () => {
      const result = findMeetingStation('bedford-av', '8-av', 'north', 'south')
      expect(result).toBe('bedford-av')
    })

    it('should default to south direction', () => {
      const result = findMeetingStation('8-av', 'bedford-av')
      expect(result).toBe('8-av')
    })

    it('should handle unknown stations gracefully', () => {
      const result = findMeetingStation('unknown', 'bedford-av')
      expect(result).toBe('unknown')
    })
  })

  describe('getVenueForStation', () => {
    it('should return a venue for bedford-av', () => {
      const result = getVenueForStation('bedford-av')
      expect(result).toBeDefined()
      expect(['The Levee', 'Cafe Reggio']).toContain(result)
    })

    it('should return a venue for lorimer-st', () => {
      const result = getVenueForStation('lorimer-st')
      expect(result).toBeDefined()
      expect(result).toBe('Mochi')
    })

    it('should return null for unknown station', () => {
      const result = getVenueForStation('unknown_station')
      expect(result).toBeNull()
    })
  })

  describe('calculateSpecificity', () => {
    it('should return 0 for empty array', () => {
      expect(calculateSpecificity([])).toBe(0)
    })

    it('should return count of interests', () => {
      expect(calculateSpecificity(['music', 'art'])).toBe(2)
      expect(calculateSpecificity(['music'])).toBe(1)
    })

    it('should return 0 for undefined', () => {
      expect(calculateSpecificity(undefined)).toBe(0)
    })

    it('should return 0 for null', () => {
      expect(calculateSpecificity(null as any)).toBe(0)
    })
  })
})
