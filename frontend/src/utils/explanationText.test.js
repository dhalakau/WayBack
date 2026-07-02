import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getExplanationText } from './explanationText'

// getExplanationText composes a distance phrase, a reason-specific phrase, and a
// "time ago" phrase. The time phrase reads Date.now(), so we freeze the clock to
// keep every assertion deterministic.
const NOW = new Date('2026-06-20T12:00:00Z').getTime()
const DAY = 1000 * 60 * 60 * 24

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('getExplanationText', () => {
  describe('reason code mapping', () => {
    it('maps nearby_and_recent_save to a distance plus save phrase', () => {
      const text = getExplanationText(
        { viewCount: 0, savedAt: NOW },
        { reason: 'nearby_and_recent_save', distanceMeters: 240 },
      )
      expect(text).toBe('240 m away · saved just now')
    })

    it('maps nearby_frequent_view to a distance, view count, and save phrase', () => {
      const text = getExplanationText(
        { viewCount: 5, savedAt: NOW },
        { reason: 'nearby_frequent_view', distanceMeters: 1500 },
      )
      expect(text).toBe('1.5 km away · viewed 5 times · saved just now')
    })

    it('maps nearby_unvisited to a not-visited-yet phrase', () => {
      const text = getExplanationText(
        { viewCount: 0, savedAt: NOW },
        { reason: 'nearby_unvisited', distanceMeters: 500 },
      )
      expect(text).toBe("500 m away · haven't visited yet · saved just now")
    })

    it('maps matches_weather_indoor to the indoor phrase and ignores distance', () => {
      const text = getExplanationText(
        { viewCount: 3, savedAt: NOW },
        { reason: 'matches_weather_indoor', distanceMeters: 999999 },
      )
      expect(text).toBe('Indoor spot · good for rainy weather · saved just now')
    })

    it('maps saved_long_ago to a revisit prompt with the elapsed time', () => {
      const text = getExplanationText(
        { viewCount: 1, savedAt: NOW - 40 * DAY },
        { reason: 'saved_long_ago', distanceMeters: 240 },
      )
      expect(text).toBe('240 m away · saved 1 month ago, time to revisit?')
    })
  })

  describe('unknown reason codes fall back gracefully', () => {
    it('returns the generic recommendation phrase for an unrecognized reason', () => {
      const text = getExplanationText(
        { viewCount: 0, savedAt: NOW },
        { reason: 'totally_made_up_reason', distanceMeters: 240 },
      )
      expect(text).toBe('Recommended for you · saved just now')
    })

    it('handles a missing reason as the generic fallback', () => {
      const text = getExplanationText(
        { viewCount: 0, savedAt: NOW },
        { distanceMeters: 240 },
      )
      expect(text).toBe('Recommended for you · saved just now')
    })
  })

  describe('time-ago edge cases (days since saved)', () => {
    it('reads a save from a few days ago as "N days ago"', () => {
      const text = getExplanationText(
        { viewCount: 0, savedAt: NOW - 3 * DAY },
        { reason: 'nearby_and_recent_save', distanceMeters: 240 },
      )
      expect(text).toBe('240 m away · saved 3 days ago')
    })

    it('reads a save from over a week ago in weeks', () => {
      const text = getExplanationText(
        { viewCount: 0, savedAt: NOW - 14 * DAY },
        { reason: 'nearby_and_recent_save', distanceMeters: 240 },
      )
      expect(text).toBe('240 m away · saved 2 weeks ago')
    })

    it('treats a null savedAt as "recently"', () => {
      const text = getExplanationText(
        { viewCount: 0, savedAt: null },
        { reason: 'nearby_and_recent_save', distanceMeters: 240 },
      )
      expect(text).toBe('240 m away · saved recently')
    })
  })

  describe('null distance is dropped from the phrase', () => {
    it('omits the distance token when distanceMeters is null', () => {
      const text = getExplanationText(
        { viewCount: 0, savedAt: NOW },
        { reason: 'nearby_unvisited', distanceMeters: null },
      )
      expect(text).toBe(" · haven't visited yet · saved just now")
    })
  })
})
