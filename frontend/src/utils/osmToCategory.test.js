import { describe, it, expect } from 'vitest'
import { osmToCategory } from './osmToCategory'

describe('osmToCategory', () => {
  // Regression tests for the three miscategorizations that were fixed during
  // dogfooding. These assertions exist to stop those specific bugs returning.
  describe('regression: known-fixed miscategorizations', () => {
    it('maps shop/bakery to cafe (not shopping)', () => {
      expect(osmToCategory('shop', 'bakery')).toBe('cafe')
    })

    it('maps amenity/cinema to attraction', () => {
      expect(osmToCategory('amenity', 'cinema')).toBe('attraction')
    })

    it('maps amenity/theatre to attraction', () => {
      expect(osmToCategory('amenity', 'theatre')).toBe('attraction')
    })
  })

  describe('shop key', () => {
    it('maps other food shops to cafe', () => {
      expect(osmToCategory('shop', 'pastry')).toBe('cafe')
      expect(osmToCategory('shop', 'confectionery')).toBe('cafe')
      expect(osmToCategory('shop', 'deli')).toBe('cafe')
      expect(osmToCategory('shop', 'chocolate')).toBe('cafe')
    })

    it('maps non-food shops to shopping', () => {
      expect(osmToCategory('shop', 'clothes')).toBe('shopping')
      expect(osmToCategory('shop', 'electronics')).toBe('shopping')
    })
  })

  describe('tourism key', () => {
    it('maps museum and gallery to museum', () => {
      expect(osmToCategory('tourism', 'museum')).toBe('museum')
      expect(osmToCategory('tourism', 'gallery')).toBe('museum')
    })

    it('maps lodging to accommodation', () => {
      expect(osmToCategory('tourism', 'hotel')).toBe('accommodation')
      expect(osmToCategory('tourism', 'hostel')).toBe('accommodation')
      expect(osmToCategory('tourism', 'guest_house')).toBe('accommodation')
      expect(osmToCategory('tourism', 'motel')).toBe('accommodation')
    })

    it('maps zoo and theme_park to park', () => {
      expect(osmToCategory('tourism', 'zoo')).toBe('park')
      expect(osmToCategory('tourism', 'theme_park')).toBe('park')
    })

    it('falls back to attraction for other tourism values', () => {
      expect(osmToCategory('tourism', 'viewpoint')).toBe('attraction')
    })
  })

  describe('leisure key', () => {
    it('maps green spaces to park', () => {
      expect(osmToCategory('leisure', 'park')).toBe('park')
      expect(osmToCategory('leisure', 'garden')).toBe('park')
      expect(osmToCategory('leisure', 'nature_reserve')).toBe('park')
    })

    it('falls back to attraction for other leisure values', () => {
      expect(osmToCategory('leisure', 'sports_centre')).toBe('attraction')
    })
  })

  describe('historic and transport keys', () => {
    it('maps any historic value to attraction', () => {
      expect(osmToCategory('historic', 'castle')).toBe('attraction')
      expect(osmToCategory('historic', 'monument')).toBe('attraction')
    })

    it('maps railway, public_transport, and aeroway to transport', () => {
      expect(osmToCategory('railway', 'station')).toBe('transport')
      expect(osmToCategory('public_transport', 'platform')).toBe('transport')
      expect(osmToCategory('aeroway', 'terminal')).toBe('transport')
    })
  })

  describe('amenity key', () => {
    it('maps cafe and ice_cream to cafe', () => {
      expect(osmToCategory('amenity', 'cafe')).toBe('cafe')
      expect(osmToCategory('amenity', 'ice_cream')).toBe('cafe')
    })

    it('maps eateries to restaurant', () => {
      expect(osmToCategory('amenity', 'restaurant')).toBe('restaurant')
      expect(osmToCategory('amenity', 'fast_food')).toBe('restaurant')
      expect(osmToCategory('amenity', 'food_court')).toBe('restaurant')
    })

    it('maps drinking venues to bar', () => {
      expect(osmToCategory('amenity', 'bar')).toBe('bar')
      expect(osmToCategory('amenity', 'pub')).toBe('bar')
      expect(osmToCategory('amenity', 'biergarten')).toBe('bar')
      expect(osmToCategory('amenity', 'nightclub')).toBe('bar')
    })

    it('maps bus_station and taxi to transport', () => {
      expect(osmToCategory('amenity', 'bus_station')).toBe('transport')
      expect(osmToCategory('amenity', 'taxi')).toBe('transport')
    })

    it('maps museum and arts_centre to museum', () => {
      expect(osmToCategory('amenity', 'museum')).toBe('museum')
      expect(osmToCategory('amenity', 'arts_centre')).toBe('museum')
    })

    it('maps civic and health services to services', () => {
      expect(osmToCategory('amenity', 'bank')).toBe('services')
      expect(osmToCategory('amenity', 'pharmacy')).toBe('services')
      expect(osmToCategory('amenity', 'hospital')).toBe('services')
      expect(osmToCategory('amenity', 'post_office')).toBe('services')
      expect(osmToCategory('amenity', 'clinic')).toBe('services')
    })

    it('falls back to attraction for other amenity values', () => {
      expect(osmToCategory('amenity', 'fountain')).toBe('attraction')
    })
  })

  describe('fallback for unrecognized input', () => {
    it('falls back to attraction for an unknown key', () => {
      expect(osmToCategory('nonsense', 'whatever')).toBe('attraction')
    })

    it('falls back to attraction for missing key and value', () => {
      expect(osmToCategory(undefined, undefined)).toBe('attraction')
    })
  })
})
