import { describe, it, expect } from 'vitest'
import { METHOD_LABEL } from './methodLabels'

// These assertions pin METHOD_LABEL to the canonical Method Mapping table in
// docs/DESIGN.md. DESIGN.md is the single source of truth: if the mapping below
// ever drifts from that table, this test fails. (The labels were once all wired
// to the wrong method, see the 2026-06-11 Decision Log entry, hence the guard.)
describe('METHOD_LABEL canonical mapping (docs/DESIGN.md)', () => {
  it('maps JITIR to "For this moment"', () => {
    expect(METHOD_LABEL.jitir).toBe('For this moment')
  })

  it('maps CBR to "Based on history"', () => {
    expect(METHOD_LABEL.cbr).toBe('Based on history')
  })

  it('maps CIA to "Near you"', () => {
    expect(METHOD_LABEL.cia).toBe('Near you')
  })

  it('matches the DESIGN.md table exactly with no extra or missing methods', () => {
    expect(METHOD_LABEL).toEqual({
      jitir: 'For this moment',
      cbr: 'Based on history',
      cia: 'Near you',
    })
  })
})
