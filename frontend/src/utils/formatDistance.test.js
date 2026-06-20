import { describe, it, expect } from 'vitest'
import { formatDistance } from './formatDistance'

describe('formatDistance', () => {
  describe('under 1 km: whole metres', () => {
    it('formats a typical short distance', () => {
      expect(formatDistance(240)).toBe('240 m')
    })

    it('rounds to the nearest metre', () => {
      expect(formatDistance(240.6)).toBe('241 m')
    })

    it('formats just under the km boundary', () => {
      expect(formatDistance(999)).toBe('999 m')
    })

    it('formats zero as 0 m', () => {
      expect(formatDistance(0)).toBe('0 m')
    })
  })

  describe('1 km to 10 km: one decimal km', () => {
    it('formats exactly 1 km', () => {
      expect(formatDistance(1000)).toBe('1.0 km')
    })

    it('formats a mid-range distance to one decimal', () => {
      expect(formatDistance(2400)).toBe('2.4 km')
    })

    it('formats 5 km', () => {
      expect(formatDistance(5000)).toBe('5.0 km')
    })
  })

  describe('above 10 km: whole km with thousands separator', () => {
    it('formats exactly 10 km as whole km', () => {
      expect(formatDistance(10000)).toBe('10 km')
    })

    it('formats a large distance with a thousands separator', () => {
      expect(formatDistance(13736000)).toBe('13,736 km')
    })
  })

  describe('null, undefined, and NaN return an empty string', () => {
    it('returns empty string for null', () => {
      expect(formatDistance(null)).toBe('')
    })

    it('returns empty string for undefined', () => {
      expect(formatDistance(undefined)).toBe('')
    })

    it('returns empty string for NaN', () => {
      expect(formatDistance(NaN)).toBe('')
    })
  })
})
